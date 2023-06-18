import { Component, Input } from '@angular/core';
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
            get: (target, key, receiver) => 
                accessor.get([ this.instance || this.node ], '$.' + key.toString()),
            set: (target, key, value, receiver) => 
                accessor.set([ this.instance || this.node ], '$.' + key.toString(), value),
        });
    }

    @Input()
    drafted : boolean;
    
    @Input()
    node : DiazoNode;

    @Input()
    component : any;

    M : any;
    instance : any;
}