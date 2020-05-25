import { JSONPath } from '@astronautlabs/jsonpath';
import { template } from './template';

/**
 * This symbol is returned by Accessor when the set of objects
 * being queried disagree about the value of a the queried property 
 * path. This is used by the 
 * {@link FiregraphEditorComponent | Firegraph editor}'s Properties sidebar
 * to know when to show "Multiple values" within a given property view.
 */
export const MULTIPLE_VALUES = Symbol('Multiple values');

/**
 * Provides a generic mechanism for dynamically getting/setting deep properties 
 * within one or more provided objects. This is the core of the Properties system
 * in Firegraph.
 */
export class Accessor {
    
    /**
     * Caution: Trusted inputs only
     * @param string 
     */
    private escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
        // https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
    }

    substitute(template : string, parms : Record<string,any>) {
        for (let key of Object.keys(parms))
            template = template.replace(new RegExp(this.escapeRegExp(`{${key}}`), 'g'), parms[key]);

        return template;
    }

    set(objects : any[], path : string, value): boolean {
        objects = objects.filter(x => x);

        if (objects.length === 0)
            return false;

        if (value === MULTIPLE_VALUES || value === undefined)
            return false;


        if (path.startsWith('$')) {
            // json path
            let changed = false;
            let found = false;
            
            for (let obj of objects) {
                let results = JSONPath.apply(obj, path, old => {
                    if (old !== value)
                        changed = true;
                    return value;
                });

                if (results.length > 0) {
                    found = true;
                }
            }

            if (!found) {
                // this path didn't exist
                console.error(`Failed to set ${path} on ${objects.length} object(s): No matches`);
            }

            return changed;
        }

        let pathParts = path.split('.');
        let firstKey = pathParts.shift();

        if (pathParts.length === 0) {
            let concatChar = null;
            let bitmaskIndex = null;
            let jsonMode = false;

            if (firstKey.includes('&')) {
                let parts = firstKey.split('&', 2);
                firstKey = parts[0];
                bitmaskIndex = parseInt(parts[1]);
            }

            if (firstKey.endsWith('$')) {
                jsonMode = true;
                firstKey = firstKey.replace(/\$$/, '');
            }

            if (firstKey.includes('|')) {
                let parts = firstKey.split('|', 2);
                firstKey = parts[0];
                concatChar = parts[1];
            }

            let changed = false;
            for (let obj of objects) {
                let finalValue = value;
                if (concatChar && value.join) {
                    finalValue = value.join(concatChar);
                }

                if (bitmaskIndex !== null) {
                    let existingValue = obj[firstKey] || 0;

                    if (finalValue) {
                        finalValue = existingValue | (1 << bitmaskIndex);
                    } else {
                        finalValue = existingValue & ~(1 << bitmaskIndex);
                    }
                } 

                if (jsonMode) {
                    try {
                        finalValue = JSON.parse(finalValue);
                    } catch (e) {
                        console.error(`Failed to parse JSON value while setting node property:`);
                        console.error(e);
                        return;
                    }
                }

                if (finalValue != obj[firstKey])
                    changed = true;
                
                if (finalValue === '∅')
                    delete obj[firstKey];
                else
                    obj[firstKey] = finalValue;
            }

            return changed;
        }

        return this.set(objects.map(x => {
            if (x[firstKey] === undefined) {
                let nextKey = pathParts[0];
                if (/^[0-9]+$/.test(nextKey)) {
                    // array
                    x[firstKey] = [];
                } else {
                    // object
                    x[firstKey] = {};
                }
            }

            return x[firstKey];
        }).filter(x => x), pathParts.join('.'), value);
    }

    private clone<T>(value : T): T {
        return JSON.parse(JSON.stringify(value));
    }

    get(objects : any[], path : string): any {
        objects = objects.filter(x => x);

        if (objects.length === 0)
            return undefined;
        
        if (path.startsWith('$')) {

            let revealMultipleValues = false;

            if (path.endsWith('?')) {
                path = path.slice(0, -1);
                revealMultipleValues = true;
            }

            // json path

            let distinctValues = [];

            for (let [object, matches] of objects.map(o => [o, JSONPath.query(o, path)])) {
                if (matches.length > 1) {
                    throw new Error(`More than one match for expression '${path}' in object ${JSON.stringify(object, undefined, 2)}`);
                }

                let value = matches[0];
                
                if (value === '∅') {
                    // look this up in defaults

                    if (object.defaults) {
                        let defaults = this.clone(object);

                        Object.keys(object.defaults)
                            .forEach(path => this.set(
                                [defaults], path, object.defaults[path]
                            )
                        );

                        let defaultValue = this.get([defaults], path);

                        if (defaultValue && defaultValue !== '∅')
                            value = template(object, defaultValue);
                        else
                            value = undefined;
                    }
                }

                if (!distinctValues.includes(value)) {
                    distinctValues.push(value);
                }
            }

            if (distinctValues.length > 1) {
                if (revealMultipleValues)
                    return MULTIPLE_VALUES;
                else
                    return undefined;
            }

            return distinctValues[0];
        }

        let pathParts = path.split('.');
        let firstKey : string = pathParts.shift();

        if (pathParts.length === 0) {
            let revealMultipleValues = false;
            let splitChar = null;
            let bitmaskIndex = null;
            let jsonMode = false;

            if (firstKey.includes('|')) {
                let parts = firstKey.split('|', 2);
                firstKey = parts[0];
                splitChar = parts[1];
            }

            if (firstKey.includes('&')) {
                let parts = firstKey.split('&', 2);
                firstKey = parts[0];
                bitmaskIndex = parseInt(parts[1]);
            }

            if (firstKey.endsWith('$')) {
                jsonMode = true;
                firstKey = firstKey.replace(/\$$/, '');
            }

            if (firstKey.endsWith('?')) {
                firstKey = firstKey.replace(/\?$/, '');
                revealMultipleValues = true;
            }
            let values = objects.map(x => x[firstKey]);
            let firstValue = values[0];

            if (jsonMode)
                firstValue = JSON.stringify(firstValue, undefined, 2);

            for (let value of values) {
                if (jsonMode)
                    value = JSON.stringify(value, undefined, 2);
                
                if (firstValue !== value) {
                    if (revealMultipleValues)
                        return MULTIPLE_VALUES;
                    else
                        return undefined;
                }
            }

            if (bitmaskIndex !== null) {
                return (parseInt(firstValue) & (1 << bitmaskIndex)) !== 0;
            }

            if (splitChar !== null && typeof firstValue === 'string') {
                firstValue = firstValue.split(splitChar);
            }

            return firstValue;
        }

        return this.get(objects.map(x => x[firstKey]).filter(x => x), pathParts.join('.'));
    }
}