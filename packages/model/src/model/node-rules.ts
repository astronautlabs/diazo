import { DiazoSlotRule } from "./slot-rule";

/**
 * @category Model
 */
export interface DiazoNodeRules {
    slots? : DiazoSlotRule;
    inputs? : DiazoSlotRule;
    outputs? : DiazoSlotRule;
}
