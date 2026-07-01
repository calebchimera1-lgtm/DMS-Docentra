import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './search.controller';

export const searchRouter = Router();
searchRouter.use(authenticate);

searchRouter.get('/', controller.search);
searchRouter.get('/saved', controller.listSavedSearches);
searchRouter.post('/saved', [body('name').notEmpty(), body('query').isObject()], validate, controller.saveSearch);
searchRouter.delete('/saved/:id', controller.deleteSavedSearch);
