import { Component, Input, ComponentFactoryResolver, Injector } from '@angular/core';
import { FiregraphNode, FiregraphContext } from '../firegraph-context';
import { Accessor } from '../accessor';

@Component({
    selector: 'fg-dynamic-node',
    templateUrl: './firegraph-dynamic-node.component.html',
    styleUrls: ['./firegraph-dynamic-node.component.scss']
})
export class FiregraphDynamicNodeComponent {
    constructor(
        private componentResolver : ComponentFactoryResolver,
        private injector : Injector,
        private context : FiregraphContext
    ) {
        let self = this;
        this.M = new Proxy({}, {
            get(target, key, receiver) {
                if (self.instance)
                    return self.accessor.get([ self.instance ], '$.' + key.toString());
                else
                    return self.accessor.get([ self.node ], '$.' + key.toString());
            },

            set(target, key, value, receiver) {
                if (self.instance)
                    return self.accessor.set([ self.instance ], '$.' + key.toString(), value);
                else
                    return self.accessor.set([ self.node ], '$.' + key.toString(), value);
            }
        });
    }

    accessor = new Accessor();
    _node : FiregraphNode;

    @Input()
    drafted : boolean;
    
    @Input()
    get node() : FiregraphNode {
        return this._node;
    }

    set node(value) {
        this._node = value;
    }

    M : any;
    instance : any;

    get component() : any {
        if (!this.node)
            return null;
        
        if (!this.node.type)
            return null;
        
        if (!this.context.nodeTypeMap)
            return null;
        
        let klass = this.context.nodeTypeMap[this.node.type];

        if (!klass)
            throw new Error(`Cannot find node component for type '${this.node.type}'`);

        return klass;
    }
}