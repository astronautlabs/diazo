import { JSONPath } from '@astronautlabs/jsonpath';

/**
 * Given a context object and a template string, interpolates
 * any present template directives and outputs the resulting 
 * string. Template directives can take one of the following
 * formats:
 * - `{{path.to.property}}` -- takes the value from the given
 *   jsonpath and uses it to replace the template directive
 * - `{{path.to.property | default}}` -- same as the above,
 *   but if `path.to.property` is falsey, uses the text "default"
 *   instead.
 */
export function template(context : any, content : string) {
    return content.replace(/\{\{([^\}]+)(\|([^\}]+))\}\}/g, (_, path, _2, def) => {
        return JSONPath.query(context, path)[0] || def || `{{not-found:${path}}}`;
    });
}