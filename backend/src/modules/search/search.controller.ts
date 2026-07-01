import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './search.service';

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q, fileType, tag, category, departmentId, authorId, folderId, dateFrom, dateTo, page, pageSize } = req.query;
  const result = await service.searchDocuments(req.user!.organizationId, {
    q: q as string,
    fileType: fileType as string,
    tag: tag as string,
    category: category as string,
    departmentId: departmentId as string,
    authorId: authorId as string,
    folderId: folderId as string,
    dateFrom: dateFrom as string,
    dateTo: dateTo as string,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json({ success: true, data: result });
});

export const saveSearch = asyncHandler(async (req: Request, res: Response) => {
  const saved = await service.saveSearch(req.user!.organizationId, req.user!.sub, req.body.name, req.body.query);
  res.status(201).json({ success: true, data: saved });
});

export const listSavedSearches = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listSavedSearches(req.user!.organizationId, req.user!.sub) });
});

export const deleteSavedSearch = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteSavedSearch(req.user!.sub, req.params.id);
  res.json({ success: true });
});
