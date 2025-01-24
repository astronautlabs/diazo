import { Input, ViewContainerRef, 
    Injector, Output, Component, 
    inject,
    Type} from '@angular/core';
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
    private injector = inject(Injector);
    private viewContainer = inject(ViewContainerRef);

    private _component : Type<any>;
    @Input()
    get component() : Type<any> {
        return this._component;
    }

    @Output()
    instanceChanged = new Subject<any>();

    instance : any;

    set component(value: Type<any>) {
        if (value === this._component)
            return;

        this._component = value;
        this.viewContainer.clear();

        if (!value)
            return;

        this.instance = this.viewContainer.createComponent(value, { injector: this.injector });
        this.instanceChanged.next(this.instance);
    }

    ngOnDestroy() {
        this.viewContainer.clear();
    }
}