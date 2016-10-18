import React, { PropTypes } from 'react';
import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';
import {
  loadEntry,
  createDraftFromEntry,
  createEmptyDraft,
  discardDraft,
  changeDraft,
  persistEntry,
} from '../actions/entries';
import { cancelEdit } from '../actions/editor';
import { addMedia, removeMedia } from '../actions/media';
import { selectEntry, getMedia } from '../reducers';
import EntryEditor from '../components/EntryEditor/EntryEditor';
import entryPageHOC from './editorialWorkflow/EntryPageHOC';
import { Loader } from '../components/UI';

class EntryPage extends React.Component {
  static propTypes = {
    addMedia: PropTypes.func.isRequired,
    boundGetMedia: PropTypes.func.isRequired,
    changeDraft: PropTypes.func.isRequired,
    collection: ImmutablePropTypes.map.isRequired,
    createDraftFromEntry: PropTypes.func.isRequired,
    createEmptyDraft: PropTypes.func.isRequired,
    discardDraft: PropTypes.func.isRequired,
    entry: ImmutablePropTypes.map,
    entryDraft: ImmutablePropTypes.map.isRequired,
    loadEntry: PropTypes.func.isRequired,
    persistEntry: PropTypes.func.isRequired,
    removeMedia: PropTypes.func.isRequired,
    cancelEdit: PropTypes.func.isRequired,
    slug: PropTypes.string,
    newEntry: PropTypes.bool.isRequired,
  };

  componentDidMount() {
    const { entry, newEntry, collection, slug, createEmptyDraft, loadEntry } = this.props;

    if (newEntry) {
      createEmptyDraft(collection);
    } else {
      loadEntry(entry, collection, slug);
      this.createDraft(entry);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.entry === nextProps.entry) return;
    if (nextProps.entry && !nextProps.entry.get('isFetching')) {
      this.createDraft(nextProps.entry);
    } else if (nextProps.newEntry) {
      this.props.createEmptyDraft(nextProps.collection);
    }
  }

  componentWillUnmount() {
    this.props.discardDraft();
  }

  createDraft = (entry) => {
    if (entry) this.props.createDraftFromEntry(entry);
  };

  handlePersistEntry = () => {
    const { persistEntry, collection, entryDraft } = this.props;
    persistEntry(collection, entryDraft);
  };

  render() {
    const {
      entry,
      entryDraft,
      boundGetMedia,
      collection,
      changeDraft,
      addMedia,
      removeMedia,
      cancelEdit,
    } = this.props;

    if (entryDraft == null
      || entryDraft.get('entry') === undefined
      || (entry && entry.get('isFetching'))) {
      return <Loader active>Loading entry...</Loader>;
    }
    return (
      <EntryEditor
        entry={entryDraft.get('entry')}
        getMedia={boundGetMedia}
        collection={collection}
        onChange={changeDraft}
        onAddMedia={addMedia}
        onRemoveMedia={removeMedia}
        onPersist={this.handlePersistEntry}
        onCancelEdit={cancelEdit}
      />
    );
  }
}

function mapStateToProps(state, ownProps) {
  const { collections, entryDraft } = state;
  const collection = collections.get(ownProps.params.name);
  const newEntry = ownProps.route && ownProps.route.newRecord === true;
  const slug = ownProps.params.slug;
  const entry = newEntry ? null : selectEntry(state, collection.get('name'), slug);
  const boundGetMedia = getMedia.bind(null, state);
  return {
    collection,
    collections,
    newEntry,
    entryDraft,
    boundGetMedia,
    slug,
    entry,
  };
}

export default connect(
  mapStateToProps,
  {
    changeDraft,
    addMedia,
    removeMedia,
    loadEntry,
    createDraftFromEntry,
    createEmptyDraft,
    discardDraft,
    persistEntry,
    cancelEdit,
  }
)(entryPageHOC(EntryPage));
