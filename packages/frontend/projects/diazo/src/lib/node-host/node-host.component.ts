import { Input, ComponentFactoryResolver, ViewContainerRef, 
    Injector, Output, Component } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * @category Component
 */
@Component({
    selector: 'dz-node-host',
    template: '',
    styles: ['']
})
export class NodeHostComponent {
    constructor(
        private injector : Injector,
        private viewContainer : ViewContainerRef,
        private componentResolver : ComponentFactoryResolver
    ) {
    }

    private _component : any;
    @Input()
    get component() : any {
        return this._component;
    }

    @Output()
    instanceChanged = new Subject<any>();

    instance : any;

    set component(value) {
        if (value === this._component)
            return;

        this._component = value;
        this.viewContainer.clear();

        if (!value)
            return;
        
        let fac = this.componentResolver.resolveComponentFactory(value);

        this.instance = this.viewContainer.createComponent(fac, 0, this.injector);
        this.instanceChanged.next(this.instance);
    }

    ngOnDestroy() {
        this.viewContainer.clear();
    }
}