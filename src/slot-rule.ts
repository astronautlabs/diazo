import { DiazoSlot } from "./slot";

/**
 * @category Model
 */
export interface DiazoSlotRule {
    placement? : 'append' | 'prepend';
    count : string;
    template : DiazoSlot;
}
