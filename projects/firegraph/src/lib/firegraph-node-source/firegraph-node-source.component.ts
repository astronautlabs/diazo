import { Component, HostListener, Input, Output } from "@angular/core";
import { FiregraphContext, FiregraphNode } from '../firegraph-context';
import * as uuid from 'uuid/v4';
import { Position } from '../firegraph-context';
import { Subject } from 'rxjs';

@Component({
    selector: 'fg-node-source-button',
    template: `
        <div class="icon-container">
            <mat-icon>{{template?.icon || 'home'}}</mat-icon>
        </div>
        <div class="label">
            <div>
                <ng-content></ng-content>
            </div>
            <span class="preview" *ngIf="template?.alpha || template?.beta">
                <ng-container *ngIf="template?.alpha">
                    Alpha
                </ng-container>
                <ng-container *ngIf="template?.beta">
                    Beta
                </ng-container>
            </span>
        </div>
    `,
    styleUrls: ['./firegraph-node-source.component.scss']
})
export class FiregraphNodeSourceComponent {

    @Input()
    context : FiregraphContext;

    @Input()
    template : FiregraphNode;

    @Input()
    position : Position;

    @Output()
    inserted = new Subject<void>();
    
    @HostListener('mousedown', ['$event']) 
    onMouseDown(event : MouseEvent) {
        if (!this.context) {
            console.warn(`fg-node-source-button: No context connected, cannot instantiate node`);
            return;
        }
        
        if (!this.template) {
            console.warn(`fg-node-source-button: No template specified, cannot instantiate node`);
            return;
        }
        
        console.log(`Drafting node from ${JSON.stringify(this.template)}`);

        this.context.draftNode = Object.assign(
            {}, 
            this.template,
            <Partial<FiregraphNode>>{ 
                id: uuid(),
                x: (this.position || {}).left || 0,
                y: (this.position || {}).top || 0
            }
        );
        this.context.draftEdge = null;

        if (this.context.bufferedEdge) {
            let edge = this.context.bufferedEdge;

            if (!edge.toNodeId) {
                edge.toNodeId = this.context.draftNode.id;
                edge.toSlotId = this.context.draftNode.slots.filter(x => x.type === 'input')[0].id;
            } else {
                edge.fromNodeId = this.context.draftNode.id;
                edge.fromSlotId = this.context.draftNode.slots.filter(x => x.type === 'output')[0].id;
            }
            
            this.context.draftEdge = edge;
        }

        let release = () => {
            document.removeEventListener('mouseup', release);
            
            this.context.releaseDraftNode();
            this.inserted.next();
        };

        document.addEventListener('mouseup', release);
    }
}