import LocalForage from 'localforage';
import MediaProxy from '../../valueObjects/MediaProxy';
import { Base64 } from 'js-base64';

export default class API {
  constructor(token, url, branch) {
    this.token = token;
    this.url = url;
    this.branch = branch;
    this.repoURL = '';
  }

  requestHeaders(headers = {}) {
    return {
      Authorization: `Bearer ${ this.token }`,
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  parseJsonResponse(response) {
    return response.json().then((json) => {
      if (!response.ok) {
        return Promise.reject(json);
      }

      return json;
    });
  }

  urlFor(path, options) {
    const params = [];
    if (options.params) {
      for (const key in options.params) {
        params.push(`${ key }=${ encodeURIComponent(options.params[key]) }`);
      }
    }
    if (params.length) {
      path += `?${ params.join('&') }`;
    }
    return this.url + path;
  }

  request(path, options = {}) {
    const headers = this.requestHeaders(options.headers || {});
    const url = this.urlFor(path, options);
    return fetch(url, { ...options, headers }).then((response) => {
      if (response.headers.get('Content-Type').match(/json/) && !options.raw) {
        return this.parseJsonResponse(response);
      }

      return response.text();
    });
  }

  checkMetadataRef() {
    return this.request(`${ this.repoURL }/refs/meta/_netlify_cms`, {
      cache: 'no-store',
    })
    .then(response => response.object)
    .catch((error) => {
      // Meta ref doesn't exist
      const readme = {
        raw: '# Netlify CMS\n\nThis tree is used by the Netlify CMS to store metadata information for specific files and branches.',
      };

      return this.uploadBlob(readme)
      .then(item => this.request(`${ this.repoURL }/trees`, {
        method: 'POST',
        body: JSON.stringify({ tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: item.sha }] }),
      }))
      .then(tree => this.commit('First Commit', tree))
      .then(response => this.createRef('meta', '_netlify_cms', response.sha))
      .then(response => response.object);
    });
  }

  storeMetadata(key, data) {
    return this.checkMetadataRef()
    .then((branchData) => {
      const fileTree = {
        [`${ key }.json`]: {
          path: `${ key }.json`,
          raw: JSON.stringify(data),
          file: true,
        },
      };

      return this.uploadBlob(fileTree[`${ key }.json`])
      .then(item => this.updateTree(branchData.sha, '/', fileTree))
      .then(changeTree => this.commit(`Updating “${ key }” metadata`, changeTree))
      .then(response => this.patchRef('meta', '_netlify_cms', response.sha));
    }).then(() => {
      LocalForage.setItem(`gh.meta.${ key }`, {
        expires: Date.now() + 300000, // In 5 minutes
        data,
      });
    });
  }

  retrieveMetadata(key, data) {
    const cache = LocalForage.getItem(`gh.meta.${ key }`);
    return cache.then((cached) => {
      if (cached && cached.expires > Date.now()) { return cached.data; }

      return this.request(`${ this.repoURL }/files/${ key }.json?ref=refs/meta/_netlify_cms`, {
        params: { ref: 'refs/meta/_netlify_cms' },
        headers: { 'Content-Type': 'application/vnd.netlify.raw' },
        cache: 'no-store',
      })
      .then(response => JSON.parse(response));
    });
  }

  readFile(path, sha, branch = this.branch) {
    const cache = sha ? LocalForage.getItem(`gh.${ sha }`) : Promise.resolve(null);
    return cache.then((cached) => {
      if (cached) { return cached; }

      return this.request(`${ this.repoURL }/files/${ path }`, {
        headers: { 'Content-Type': 'application/vnd.netlify.raw' },
        params: { ref: branch },
        cache: false,
        raw: true,
      }).then((result) => {
        if (sha) {
          LocalForage.setItem(`gh.${ sha }`, result);
        }
        return result;
      });
    });
  }

  listFiles(path) {
    return this.request(`${ this.repoURL }/files/${ path }`, {
      params: { ref: this.branch },
    });
  }

  persistFiles(entry, mediaFiles, options) {
    let filename, part, parts, subtree;
    const fileTree = {};
    const uploadPromises = [];

    const files = mediaFiles.concat(entry);

    files.forEach((file) => {
      if (file.uploaded) { return; }
      uploadPromises.push(this.uploadBlob(file));
      parts = file.path.split('/').filter(part => part);
      filename = parts.pop();
      subtree = fileTree;
      while (part = parts.shift()) {
        subtree[part] = subtree[part] || {};
        subtree = subtree[part];
      }
      subtree[filename] = file;
      file.file = true;
    });
    return Promise.all(uploadPromises)
      .then(() => this.getBranch())
      .then(branchData => this.updateTree(branchData.commit.sha, '/', fileTree))
      .then(changeTree => this.commit(options.commitMessage, changeTree))
      .then(response => this.patchBranch(this.branch, response.sha));
  }

  createRef(type, name, sha) {
    return this.request(`${ this.repoURL }/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/${ type }/${ name }`, sha }),
    });
  }

  patchRef(type, name, sha) {
    return this.request(`${ this.repoURL }/refs/${ type }/${ name }`, {
      method: 'PATCH',
      body: JSON.stringify({ sha }),
    });
  }

  deleteRef(type, name, sha) {
    return this.request(`${ this.repoURL }/refs/${ type }/${ name }`, {
      method: 'DELETE',
    });
  }

  getBranch(branch = this.branch) {
    return this.request(`${ this.repoURL }/refs/heads/${ this.branch }`);
  }

  createBranch(branchName, sha) {
    return this.createRef('heads', branchName, sha);
  }

  patchBranch(branchName, sha) {
    return this.patchRef('heads', branchName, sha);
  }

  deleteBranch(branchName) {
    return this.deleteRef('heads', branchName);
  }

  createPR(title, head, base = 'master') {
    const body = 'Automatically generated by Netlify CMS';
    return this.request(`${ this.repoURL }/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base }),
    });
  }

  getTree(sha) {
    return sha ? this.request(`${ this.repoURL }/trees/${ sha }`) : Promise.resolve({ tree: [] });
  }

  toBase64(str) {
    return Promise.resolve(
      Base64.encode(str)
    );
  }

  uploadBlob(item) {
    const content = item instanceof MediaProxy ? item.toBase64() : this.toBase64(item.raw);

    return content.then((contentBase64) => {
      return this.request(`${ this.repoURL }/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: contentBase64,
          encoding: 'base64',
        }),
      }).then((response) => {
        item.sha = response.sha;
        item.uploaded = true;
        return item;
      });
    });
  }

  updateTree(sha, path, fileTree) {
    return this.getTree(sha)
      .then((tree) => {
        let obj, filename, fileOrDir;
        const updates = [];
        const added = {};

        for (let i = 0, len = tree.tree.length; i < len; i++) {
          obj = tree.tree[i];
          if (fileOrDir = fileTree[obj.path]) {
            added[obj.path] = true;
            if (fileOrDir.file) {
              updates.push({ path: obj.path, mode: obj.mode, type: obj.type, sha: fileOrDir.sha });
            } else {
              updates.push(this.updateTree(obj.sha, obj.path, fileOrDir));
            }
          }
        }
        for (filename in fileTree) {
          fileOrDir = fileTree[filename];
          if (added[filename]) { continue; }
          updates.push(
            fileOrDir.file ?
              { path: filename, mode: '100644', type: 'blob', sha: fileOrDir.sha } :
              this.updateTree(null, filename, fileOrDir)
          );
        }
        return Promise.all(updates)
          .then((updates) => {
            return this.request(`${ this.repoURL }/trees`, {
              method: 'POST',
              body: JSON.stringify({ base_tree: sha, tree: updates }),
            });
          }).then((response) => {
            return { path, mode: '040000', type: 'tree', sha: response.sha, parentSha: sha };
          });
      });
  }

  commit(message, changeTree) {
    const tree = changeTree.sha;
    const parents = changeTree.parentSha ? [changeTree.parentSha] : [];
    return this.request(`${ this.repoURL }/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree, parents }),
    });
  }

}
