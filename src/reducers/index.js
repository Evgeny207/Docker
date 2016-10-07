import auth from './auth';
import config from './config';
import editor from './editor';
import entries, * as fromEntries from './entries';
import editorialWorkflow, * as fromEditorialWorkflow from './editorialWorkflow';
import entryDraft from './entryDraft';
import collections from './collections';
import medias, * as fromMedias from './medias';

const reducers = {
  auth,
  config,
  collections,
  editor,
  entries,
  editorialWorkflow,
  entryDraft,
  medias,
};

export default reducers;

/*
 * Selectors
 */
export const selectEntry = (state, collection, slug) =>
  fromEntries.selectEntry(state.entries, collection, slug);

export const selectEntries = (state, collection) =>
  fromEntries.selectEntries(state.entries, collection);

export const selectUnpublishedEntry = (state, status, slug) =>
  fromEditorialWorkflow.selectUnpublishedEntry(state.editorialWorkflow, status, slug);

export const selectUnpublishedEntries = (state, status) =>
  fromEditorialWorkflow.selectUnpublishedEntries(state.editorialWorkflow, status);

export const getMedia = (state, path) =>
  fromMedias.getMedia(state.medias, path);
