import { LoggerService } from "@backstage/backend-plugin-api";
import Router from 'express-promise-router';
import express from 'express'

export function createExampleRouter(logger: LoggerService): express.Router {
    const router = Router();

    router.get('/header', (_req, res) => {
        logger.info('Servung example header data');
        res.json({ title: 'Hello from Lukas'});
    });

    return router;
}