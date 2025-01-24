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
import { MonacoEditorModule } from '@astronautlabs/monaco';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';

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

/**
 * @category Module
 */
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