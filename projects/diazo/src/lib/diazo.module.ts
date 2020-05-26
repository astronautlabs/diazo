import { NgModule } from "@angular/core";
import { GraphComponent } from './graph/graph.component';
import { DynamicNodeComponent } from './dynamic-node/dynamic-node.component';
import { NodeHostComponent } from './node-host/node-host.component';
import { SlotComponent } from './slot/slot.component';
import { NodeComponent } from './node/node.component';
import { CommonModule } from '@angular/common';
import { EditorComponent } from './editor/editor.component';
import { NodeSourceButtonComponent } from './node-source-button/node-source-button.component';
import { TrustHtmlPipe } from './trust-html.pipe';
import { PropertyEditorHostComponent } from './property-editor-host/property-editor-host.component';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

/**
 * @hidden
 */
const DECLARATIONS = [
    GraphComponent,
    DynamicNodeComponent,
    NodeComponent,
    NodeHostComponent,
    SlotComponent,
    EditorComponent,
    NodeSourceButtonComponent,
    PropertyEditorHostComponent,
    TrustHtmlPipe
];

@NgModule({
    declarations: DECLARATIONS,
    exports: DECLARATIONS,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        DragDropModule,
        FormsModule,
        MatSelectModule,
        MatTabsModule,
        MatRadioModule,
        MatCheckboxModule,
        MatDividerModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatExpansionModule,
        MatSnackBarModule,
        MatMenuModule,
        MatSlideToggleModule,
        MonacoEditorModule
    ]
})
export class DiazoModule {

}