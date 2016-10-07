import YAML from './yaml';

const regexp = /^---\n([^]*?)\n---\n([^]*)$/;

export default class YAMLFrontmatter {
  fromFile(content) {
    const match = content.match(regexp);
    const obj = match ? new YAML().fromFile(match[1]) : {};
    obj.body = match ? (match[2] || '').replace(/^\n+/, '') : content;
    return obj;
  }

  toFile(data) {
    const meta = {};
    let body = '';
    let content = '';
    for (const key in data) {
      if (key === 'body') {
        body = data[key];
      } else {
        meta[key] = data[key];
      }
    }

    content += '---\n';
    content += new YAML().toFile(meta);
    content += '---\n\n';
    content += body;
    return content;
  }
}
