/**
 * Represents a registered custom property type view. This is used 
 * to convey the list of custom property type views from the consumer of the 
 * library to the {@link DiazoEditorComponent | Diazo editor}.
 * 
 * @category Model
 */
export interface DiazoCustomPropertyType {
    namespace : string;
    id : string;
    component : any;
}