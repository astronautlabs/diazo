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

    /**
     * Whether a value is required for this property or not. 
     */
    required?: boolean;

    /**
     * Default value to use when this property has been mapped to a slot,
     * but that slot is not occupied by an edge.
     */
    defaultValue?: any;
    
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
