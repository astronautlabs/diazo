import { DiazoValue } from "./value";
import { DiazoPropertyInlineMatrix } from "./inline-matrix";
import { DiazoPropertyMatrix } from "./property-matrix";
import { DiazoPropertyBitmask } from "./property-bitmask";
import { DiazoPropertyOption } from "./property-option";

/**
 * @category Model
 */
export interface DiazoProperty {
    label? : string;
    path? : string;
    description? : string;
    readonly? : boolean;
    slottable? : boolean;
    slotValue? : DiazoValue;
    allowAnnotation? : boolean;
    
    type : 'number' | 'text' | 'bitmask' | 'json'
            | 'textarea' | 'select' | 'flags' | 'position' 
            | 'boolean' | 'matrix' | 'inline-matrix' | string;
    typeOptions? : any;
    inlineMatrix? : DiazoPropertyInlineMatrix;
    matrix? : DiazoPropertyMatrix;
    bitmask? : DiazoPropertyBitmask;
    options? : DiazoPropertyOption[];
    optionSource? : string;
}
