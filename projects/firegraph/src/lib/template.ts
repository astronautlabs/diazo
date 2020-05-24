import { JSONPath } from '@astronautlabs/jsonpath';

export function template(context : any, content : string) {
    return content.replace(/\{\{([^\}]+)(\|([^\}]+))\}\}/g, (_, path, _2, def) => {
        return JSONPath.query(context, path)[0] || def || `{{not-found:${path}}}`;
    });
}