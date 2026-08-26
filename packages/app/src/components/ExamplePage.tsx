import { useApi } from "@backstage/frontend-plugin-api";
import { exampleApiRef } from "../api";
import { useEffect, useState } from "react";

export function ExamplePage() {
    const exampleApi = useApi(exampleApiRef);
    const [title, setTitle] = useState<string | null>(null);
    
    useEffect(() => {
        exampleApi.getExample().then(data => setTitle(data.title));
    }, [exampleApi]);

    return (
        <div>
            <h1>{title ?? 'Loading...'}</h1>
        </div>
    );
}