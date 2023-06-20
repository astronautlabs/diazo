import { Component, Input, HostBinding } from '@angular/core';
import { Accessor, DiazoNode } from '@diazo/model';

/**
 * Provides a <dz-node> which supports custom 
 * @category Component
 */
@Component({
    selector: 'dz-dynamic-node',
    templateUrl: './dynamic-node.component.html',
    styleUrls: ['./dynamic-node.component.scss']
})
export class DynamicNodeComponent {
    constructor() {
        let accessor = new Accessor();
        this.M = new Proxy({}, {
            get: (target, key, receiver) => {
                if (typeof key === 'symbol')
                    return (this.instance || this.node)[key];

                return accessor.get([ this.instance || this.node ], '$.' + key.toString());
            }, set: (target, key, value, receiver) => {
                if (typeof key === 'symbol')
                    return (this.instance || this.node)[key] = value;

                return accessor.set([ this.instance || this.node ], '$.' + key.toString(), value);
            }
        });
    }

    @HostBinding('attr.data-nodeId')
    get nodeId() { return this.node?.id; }

    @Input()
    drafted : boolean;
    
    @Input()
    node : DiazoNode;

    @Input()
    component : any;

    M : any;
    instance : any;
}