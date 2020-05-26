import { Component, Input, ComponentFactoryResolver, Injector } from '@angular/core';
import { Accessor } from '../accessor';
import { DiazoNode } from '../model';

/**
 * Provides a <dz-node> which supports custom 
 */
@Component({
    selector: 'dz-dynamic-node',
    templateUrl: './diazo-dynamic-node.component.html',
    styleUrls: ['./diazo-dynamic-node.component.scss']
})
export class DiazoDynamicNodeComponent {
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