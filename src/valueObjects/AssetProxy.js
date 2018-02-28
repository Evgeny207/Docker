import { resolvePath } from 'Lib/pathHelper';
import { currentBackend } from "Backends/backend";
import { getIntegrationProvider } from 'Integrations';
import { selectIntegration } from 'Reducers';

let store;
export const setStore = (storeObj) => {
  store = storeObj;
};

export default function AssetProxy(value, fileObj, uploaded = false, asset) {
  const config = store.getState().config;
  this.value = value;
  this.fileObj = fileObj;
  this.uploaded = uploaded;
  this.sha = null;
  this.path = config.get('media_folder') && !uploaded ? resolvePath(value, config.get('media_folder')) : value;
  this.public_path = !uploaded ? resolvePath(value, config.get('public_folder')) : value;
  this.asset = asset;
}

AssetProxy.prototype.toString = function () {
  // Use the deployed image path if we do not have a locally cached copy.
  if (this.uploaded && !this.fileObj) return this.public_path;
  try {
    return window.URL.createObjectURL(this.fileObj);
  } catch (error) {
    return null;
  }
};

AssetProxy.prototype.dataURItoBlob = function(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  var ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  return new Blob([ab], {type: mimeString});

}

AssetProxy.prototype.toBase64 = function () {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (readerEvt) => {
      const binaryString = readerEvt.target.result;

      resolve(binaryString.split('base64,')[1]);
    };
    fr.readAsDataURL(this.fileObj);
  });
};


AssetProxy.prototype.toBlob = function () {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (readerEvt) => {
      const binaryString = readerEvt.target.result;

      resolve(this.dataURItoBlob(binaryString));
    };
    fr.readAsDataURL(this.fileObj);
  });
};

export function createAssetProxy(value, fileObj, uploaded = false, privateUpload = false) {
  const state = store.getState();
  const integration = selectIntegration(state, null, 'assetStore');
  if (integration && !uploaded) {
    const provider = integration && getIntegrationProvider(state.integrations, currentBackend(state.config).getToken, integration);
    return provider.upload(fileObj, privateUpload).then(
      response => (
        new AssetProxy(response.asset.url.replace(/^(https?):/, ''), null, true, response.asset)
      ),
      error => new AssetProxy(value, fileObj, false)
    );
  } else if (privateUpload) {
    throw new Error('The Private Upload option is only avaible for Asset Store Integration');
  }

  return Promise.resolve(new AssetProxy(value, fileObj, uploaded));
}
