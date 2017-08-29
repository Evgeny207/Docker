import LocalForage from "localforage";
import { Base64 } from "js-base64";
import FormData from "form-data";
import AssetProxy from "../../valueObjects/AssetProxy";
import { SIMPLE, EDITORIAL_WORKFLOW, } from "../../constants/publishModes";
import { APIError } from "../../valueObjects/errors";
import Authenticator from '../../lib/netlify-auth';

export default class API {
  //todo: here I pass in setUser because api has no notion of implementation's user
  constructor(config, setUser) {
    this.setUser = setUser;
    this.refresh_token = config.refresh_token || false;
    this.expires_at = config.expires_at || false;
    this.api_root = config.api_root || "https://api.bitbucket.org/2.0";
    this.token = config.token || false;
    this.branch = config.branch || "master";
    this.repo = config.repo || "";
    this.repoURL = `/repositories/${ this.repo }`;
  }

  user() {
    return this.request("/user");
  }

  hasWriteAccess(user) {
    return this.request(`/repositories/${ user.username }`, {
      params: { role: "contributor", q: `full_name="${ this.repo }"` },
    }).then((r) => {
      const repos = r.values;
      let contributor = false;
      for (const repo of repos) {
        if (this.repo === `${ repo.full_name }`) contributor = true;
      }
      return contributor;
    });
  }

  requestHeaders(headers = {}) {
    const baseHeader = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (this.token) {
      baseHeader.Authorization = `Bearer ${ this.token }`;
      return baseHeader;
    }

    return baseHeader;
  }

  formRequestHeaders(headers = {}) {
    const baseHeader = {
      ...headers,
    };

    if (this.token) {
      baseHeader.Authorization = `Bearer ${ this.token }`;
      return baseHeader;
    }

    return baseHeader;
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
    const cacheBuster = new Date().getTime();
    const params = [`ts=${cacheBuster}`];
    if (options.params) {
      for (const key in options.params) {
        params.push(`${ key }=${ encodeURIComponent(options.params[key]) }`);
      }
    }
    if (params.length) {
      path += `?${ params.join("&") }`;
    }
    return this.api_root + path;
  }

  isTokenExpired() {
    const expirationWindowInSeconds = 300; //gives us a small buffer for edge cases like network latency
    const expirationTimeInSeconds = (new Date(this.expires_at)).getTime() / 1000;
    const expirationWindowStart = expirationTimeInSeconds - expirationWindowInSeconds;
    const nowInSeconds = (new Date()).getTime() / 1000;
    return nowInSeconds >= expirationWindowStart;
  }

  checkRefreshToken(){
    return new Promise((resolve, reject) => {
      let token = this.token;
      let refreshToken = this.refresh_token;

      const tokenExpired = this.isTokenExpired();
      if (tokenExpired) {
        const auth = new Authenticator();
        auth.refreshAuthToken({ access_token: token, refresh_token: refreshToken }).then((data) => {
          this.token = data.result.token.access_token;
          this.expires_at = data.result.token.expires_at;
          this.setUser({token:this.token, refresh_token:refreshToken, expires_at:this.expires_at});
          resolve(true);
        });
      } else {
        resolve(true);
      }
    });

  }

  request(path, options = {}) {
    return this.checkRefreshToken().then(() => {
      const headers = this.requestHeaders(options.headers || {});
      const url = this.urlFor(path, options);
      let responseStatus;
      return fetch(url, { ...options, headers }).then((response) => {
        responseStatus = response.status;
        const contentType = response.headers.get("Content-Type");
        if (contentType && contentType.match(/json/)) {
          return this.parseJsonResponse(response);
        }
        return response.text();
      })
      .catch((error) => {
        throw new APIError(error.message, responseStatus, 'Bitbucket');
      });
    });
  }

  //formrequest uses different headers for a form request vs normal json request
  formRequest(path, options = {}) {
    return this.checkRefreshToken().then(() => {
      const headers = this.formRequestHeaders(options.headers || {});
      const url = this.urlFor(path, options);
      let responseStatus;
      return fetch(url, { ...options, headers }).then((response) => {
        responseStatus = response.status;
        const contentType = response.headers.get("Content-Type");
        if (contentType && contentType.match(/json/)) {
          return this.parseJsonResponse(response);
        }
        return response.text();
      })
      .catch((error) => {
        throw new APIError(error.message, responseStatus, 'Bitbucket');
      });
    });
  }

  readFile(path, sha, branch = this.branch) {
    const cache = sha ? LocalForage.getItem(`gh.${ sha }`) : Promise.resolve(null);
    return cache.then((cached) => {
      if (cached) { return cached; }

      return this.request(`${ this.repoURL }/src/${ branch }/${ path }`, {
        cache: "no-store",
      }).then((result) => {
        if (sha) {
          LocalForage.setItem(`gh.${ sha }`, result);
        }
        return result;
      });
    });
  }

  listFiles(path) {
    return this.request(`${ this.repoURL }/src/${ this.branch }/${ path }`, {})
    .then(files => {
      if (!Array.isArray(files.values)) {
        throw new Error(`Cannot list files, path ${path} is not a directory`);
      }
      return files.values;
    })
    .then(files => {
      return files.filter(file => file.type === "commit_file")
    });
  }

  persistFiles(entry, mediaFiles, options) {
    const uploadPromises = [];
    const files = mediaFiles.concat(entry);

    files.forEach((file) => {
      if (file.uploaded) { return; }
      uploadPromises.push(this.uploadBlob(file));
    });

    if (options.mode && options.mode === EDITORIAL_WORKFLOW) {
      console.warn("Editorial worflow is not supported yet with Bitbucket API.")
    }

    return Promise.all(uploadPromises).then(() => {
      if (!options.mode || (options.mode && options.mode === SIMPLE)) {
        return this.getBranch();
      }
    });
  }

  deleteFile(path, message, options={}) {
    const branch = options.branch || this.branch;

    let formData = new FormData();
    formData.append('files', path);
    if (message && message != "") {
      formData.append('message', message) ;
    }
    return this.formRequest(`${ this.repoURL }/src`, {
      method: 'POST',
      body: formData
    });
  }

  getBranch(branch = this.branch) {
    return this.request(`${ this.repoURL }/refs/branches/${ encodeURIComponent(branch) }`);
  }

  uploadBlob(item) {
    const content = item instanceof AssetProxy ? item.toBlob() : Promise.resolve(item.raw);

    return content.then(contentBase64 => {
      let formData = new FormData();
      formData.append(item.path, contentBase64);

      this.formRequest(`${ this.repoURL }/src`, {
        method: 'POST',
        body: formData
      }).then((response) => {
        //item.sha = response.sha; //todo: get commit sha from bitbucket?
        item.uploaded = true;
        return item;
      })
    });
  }
}
