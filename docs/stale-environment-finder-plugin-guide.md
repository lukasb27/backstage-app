# Building the Stale Environment Finder Plugin

This is a walkthrough of how the Stale Environment Finder plugin was built — what
problem it solves, how the pieces fit together, and what went wrong along the way
that's worth knowing before you build the next one. It's written for anyone
reading the plugin's code for the first time, whether or not you're the one
touching the TypeScript.

## What it does, and why

Every open pull request against `fermentation-station-agent` gets its own
temporary environment — a live, running copy of the service, deployed
automatically by CI so you can click around a real instance of your change
before it merges. When the PR closes, that environment is supposed to get torn
down automatically too.

"Supposed to" is the operative phrase. CI jobs fail, cleanup steps get skipped,
and branch names occasionally collide in ways that quietly break the teardown
step. When that happens, you end up with a live environment nobody's using,
consuming cluster resources, with no obvious way to tell it apart from one that's
still legitimately in use — short of manually cross-referencing GitHub PRs
against Argo CD by hand.

The Stale Environment Finder plugin does that cross-referencing for you. It adds
an **Environments** tab to a service's page in Backstage, listing every
environment tied to that service and whether the PR behind it is still open. If
it isn't, the environment is flagged stale — a strong signal it can be safely
torn down.

## How it's put together

The plugin is really two plugins working together, which is the normal shape for
anything in Backstage that needs both a UI and server-side logic:

- **A backend plugin** that does the actual work: it asks GitHub for a repo's
  pull requests, asks Argo CD for that repo's deployed environments, and matches
  the two up.
- **A frontend plugin** that adds the Environments tab to a service's page and
  displays whatever the backend found.

### The backend: matching PRs to environments

The backend has three jobs, kept deliberately separate:

1. **Ask GitHub which PRs exist**, and whether each one is open, closed, or
   merged.
2. **Ask Argo CD which environments exist.** Each environment (an Argo CD
   "Application") carries metadata — set by the CI job that created it — saying
   which PR number and which repo it belongs to.
3. **Line the two lists up.** For every environment, look up its PR by number.
   If the PR is open, the environment's healthy. If it's closed or merged, it's
   stale. If there's no matching PR at all, something's unclear enough that it
   deserves a human's attention rather than an automatic verdict either way.

That third job — matching things up correctly — turned out to hide more sharp
edges than it looks like it should. More on that below.

### The frontend: one tab, one table

The frontend side is intentionally simple: it reads which repository the
current service maps to (from a standard annotation already on every service's
catalog entry), asks the backend for that repo's environments, and renders them
in a table. No state to manage beyond loading and error handling.

## Building it: roughly the order things happened

1. **Backend clients first, in isolation.** A small module that talks to GitHub
   (using Backstage's built-in credential handling, not a hand-rolled token),
   and a small module that talks to Argo CD's REST API directly, since no
   official TypeScript client exists for it.
2. **The matching logic**, as a plain, dependency-free function — given a list
   of PRs and a list of environments, return which environments are stale and
   why. Keeping this pure (no network calls inside it) made it trivial to unit
   test later.
3. **The HTTP route** that ties the clients and the matching logic together,
   validates its inputs, and returns JSON.
4. **The frontend tab and its data-fetching component.**
5. **Tests** — for the matching logic specifically, and for the route's
   behavior end-to-end with the external calls mocked out.
6. **Wiring it into the real, deployed instance of Backstage** — which is where
   most of the actual debugging happened, described below.

## What actually went wrong (read this part)

Nothing here means the plugin was built badly. It means plugin development in
Backstage — and infrastructure integration work generally — has a set of
sharp edges that aren't obvious until you hit them once. Consider this the
"hit them once so you don't have to" section.

### Config that only exists locally doesn't exist in production

This was the big one. While developing, the plugin's Argo CD credentials were
added to a local-only config file (never committed, used purely for a
developer's own machine). That's the correct place for secrets during
development — but it's easy to stop there and forget the equivalent needs
adding to the actual production config too, since locally everything just
works.

It did just work, locally. Then the PR merged, and the production pod
crash-looped on boot with a very clear error: a required config value was
missing. The fix was straightforward once diagnosed, but it was a live
incident, not a code review comment — worth remembering that "works on my
machine" for config specifically means checking two files, not one.

### External systems don't always play by the rules you expect

Argo CD's API doesn't offer a way to ask "give me only the environments for
this one repository" — it hands back everything, and filtering by repo has to
happen in your own code afterward. That's a reasonable API design, but it's
easy to assume every API works the way GitHub's does (which *does* let you ask
for exactly what you want) until you check.

Relatedly: Argo CD returns an explicit `null`, not an empty list, when there's
nothing to report. Code that assumes "if it's missing, it's at least an empty
array" breaks the first time production genuinely has zero of something.

### Two things that look interchangeable often aren't

An environment with no matching PR at all is a different situation from an
environment whose PR is definitely closed — the first one might just mean a
lookup went wrong somewhere, the second is a confident, actionable signal. The
first version of the matching logic treated both cases identically, which
meant a transient GitHub API hiccup could get a perfectly healthy environment
flagged for deletion. Worth asking, for any "is this thing okay?" check: what
does "I couldn't tell" actually mean, and does it deserve the same answer as a
confirmed "no"?

The same lesson showed up a second time in matching: two different PRs, in two
different repositories, can end up with the same PR number. Matching purely
by number (without also checking which repository an environment actually
belongs to) meant an environment could occasionally get matched against the
wrong PR entirely.

### A self-signed certificate has to be trusted twice

The internal Argo CD server uses a certificate it signed itself, rather than
one issued by a public certificate authority. That meant a developer's own
laptop needed to be told to trust it before local testing would work — and,
separately, the actual server the plugin runs on in production needed the
exact same trust configured for it too. Fixing the first one feels like fixing
the problem; the second one is a distinct step that's easy to genuinely forget
about until production starts throwing certificate errors that never showed up
in dev.

### A plugin's dependencies belong to that plugin

Early on, a couple of libraries the plugin needed were only technically
available because a *different*, unrelated package elsewhere in the repo
happened to already depend on them. It worked, right up until an automated
code review caught it — that kind of accidental borrowing breaks the moment
the plugin is built or tested in isolation, since it's declaring a dependency
on something it never officially asked for.

### A quiet CI safeguard

One PR's changes didn't trigger a new build, which looked like something was
broken. It wasn't — deployment configuration changes are deliberately excluded
from triggering a rebuild, specifically to stop the automated "here's the new
build" commit from endlessly triggering another build of itself. Worth knowing
this filter exists on purpose, so it doesn't look like a CI failure the next
time a config-only change doesn't kick off a build.

## Tips for the next plugin

- **Write to the production config file the same day you write to the local
  one.** Even if you can't fill in a real secret value yet, get the key added
  so it's not a surprise at merge time.
- **A platform's own auth layer can reject a request before your plugin's code
  ever runs.** If a route seems to reject every request no matter what you
  send it, check whether that's coming from your own logic or from the
  platform underneath it first.
- **Deliberately manufacture the failure case you're worried about**, rather
  than waiting to encounter it by accident. For this plugin, that meant
  hand-crafting a test environment that pointed at a PR known to be closed,
  rather than hoping a real one would end up in that state before anyone
  checked whether the "stale" detection actually worked.
- **A review pass is cheap insurance.** Several of the issues above were caught
  by a review round after the plugin already seemed to be working end-to-end —
  each fix was small once identified, but none of them were things testing
  the happy path would have caught.
