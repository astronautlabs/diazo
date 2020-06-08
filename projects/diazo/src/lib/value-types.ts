import { DiazoSlotContext, DiazoValueType } from './context';
import { DiazoValue } from '@diazo/model';

/**
 * Provides an abstract base class for new Diazo value types that provides
 * heirarchical compatibility by default.
 * 
 * Custom value types which inherit from `DiazoTypeBase` will automatically
 * grant implicit conversions which broaden the "value" of the edge and deny
 * conversions which narrow the "value of the edge.
 * 
 * Given:
 * 
 * ```typescript
 * export class TypeA extends DiazoTypeBase {}
 * export class TypeB extends TypeA {}
 * ```
 * 
 * - A connection from an output slot of `TypeB` **can be assigned** to an input slot of 
 * `TypeA`
 * - A connection from an output slot of `TypeA` **cannot be assigned** to an input slot of `TypeB`
 * 
 * This may or may not be the behavior you want from your custom value types.
 * You can override the {@linkcode isCompatible} method to change this behavior,
 * or implement {@linkcode DiazoValueType} directly instead. 
 * 
 * @category Editor
 */
export class DiazoTypeBase implements Partial<DiazoValueType> {
    isCompatible(
        output : DiazoSlotContext,
        input : DiazoSlotContext
    ) {
        return (output.valueType === input.valueType
                || output.valueType instanceof input.valueType.constructor ) 
            && this.isExpressionCompatible(output, input)
        ;
    }

    public static value<T extends typeof DiazoTypeBase>(this : T, params? : any): DiazoValue {
        let x : DiazoValueType = new (<any>this)();
        return { type: x.id, params };
    }

    isExpressionCompatible(
        output : DiazoSlotContext,
        input : DiazoSlotContext
    ) {
        return true;
    }
}

/**
 * Provides a special value type that works by inference. You create 
 * named wildcard values within your slots using {@link WildcardType.named()}
 * and the Diazo editor will automatically infer what value the slot really
 * is by analyzing other existing edges in the graph. You can use this if the 
 * node can take any value in, but the output should follow what the input edge 
 * is. Note that this works in any direction. If you attach an edge to the 
 * wildcard output on your node, the corresponding input(s) will immediately 
 * reflect that inference.
 * 
 * So for example:
 * ```typescript
 * <DiazoNode>{
 *      label: 'My Node',
 *      slots: [
 *          {
 *              id: 'input1',
 *              type: 'input',
 *              value: WildcardType.named('T')
 *          },
 *          {
 *              id: 'output1',
 *              type: 'output',
 *              value: WildcardType.named('T')
 *          },
 *      ]
 * }
 * ```
 * 
 * If you connect an edge to either the `input1` or `output1` slots, the other
 * slot will immediately reflect the value type of that edge.
 * 
 * @category Editor
 */
export class WildcardType extends DiazoTypeBase implements DiazoValueType {
    id = 'wildcard';
    color = 'pink';
    description = 'Works for any value';
    name = 'Wildcard';
    splittable = true;

    isCompatible(
        output : DiazoSlotContext,
        input : DiazoSlotContext
    ) {
        return this.isExpressionCompatible(output, input);
    }

    getColorByContext(slot : DiazoSlotContext) {
        let value = this.resolveSlotType(slot);

        if (value) {
            let type = slot.graph.getValueTypeById(value.type);
            if (type) {
                if (type.getColorByContext)
                    return type.getColorByContext(slot);
                if (type.color)
                    return type.color;
            }
        }

        return `white`;
    }

    getNameByContext(slot : DiazoSlotContext) {

        let value = this.resolveSlotType(slot);

        if (value) {
            return `Wildcard (Bound: ${value.type})`;
        }

        return `Wildcard (Unbound)`;
    }

    resolveSlotType(slot : DiazoSlotContext, visitedSlots : DiazoSlotContext[] = []): DiazoValue {

        if (!slot.value)
            return null;

        if (slot.value.type === 'wildcard') {
            let wildcardType = slot.value.params.templateName;

            // Find incoming edges on this slot and see if any of them can be resolved

            for (let edge of slot.edges) {
                let otherSlot = slot.getOtherSlotOfEdge(edge);
                if (visitedSlots.includes(otherSlot))
                    continue;

                let otherValue = this.resolveSlotType(otherSlot, visitedSlots.concat([ slot ]));

                if (otherValue)
                    return otherValue;
            }

            // If we couldn't resolve this type via incoming edges to _this_ slot, attempt 
            // to resolve the type by looking at other slots on this node with the same wildcard
            // templateName

            let unvisitedSlots = slot.node.slots
                .filter(x => !visitedSlots.includes(x) && x.value.type === 'wildcard' && x.value.params.templateName === wildcardType)
            ;

            for (let otherSlot of unvisitedSlots) {
                let otherValue = this.resolveSlotType(otherSlot, visitedSlots.concat([ slot ]));
                if (otherValue)
                    return otherValue;
            }

            // wildcard unbound

            return null;
        }

        return slot.value;
    }

    isExpressionCompatible(
        output : DiazoSlotContext,
        input : DiazoSlotContext
    ) {
        let outputValue = this.resolveSlotType(output);
        let inputValue = this.resolveSlotType(input);

        if (output.value && output.value.type === 'wildcard' && !outputValue) {
            return true;
        }

        if (input.value && input.value.type === 'wildcard' && !inputValue) {
            return true;
        }

        // console.log(`Checking compat:`);
        // console.dir(outputValue);
        // console.dir(inputValue);

        return output.graph.valuesCompatible(outputValue, inputValue);
    }

    public static named(templateName : string): DiazoValue {
        return WildcardType.value({ templateName });
    }
}
