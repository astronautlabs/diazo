import { NgModule } from "@angular/core";
import { DiazoComponent } from './diazo/diazo.component';
import { DiazoDynamicNodeComponent } from './diazo-dynamic-node/diazo-dynamic-node.component';
import { DiazoNodeHostComponent } from './diazo-node-host/diazo-node-host.component';
import { DiazoSlotComponent } from './diazo-slot/diazo-slot.component';
import { DiazoNodeComponent } from './diazo-node/diazo-node.component';
import { CommonModule } from '@angular/common';
import { DiazoEditorComponent } from './diazo-editor/diazo-editor.component';
import { DiazoNodeSourceComponent } from './diazo-node-source/diazo-node-source.component';
import { TrustHtmlPipe } from './trust-html.pipe';
import { CustomPropertyEditorHostComponent } from './custom-property-editor-host/custom-property-editor-host.component';
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
    DiazoComponent,
    DiazoDynamicNodeComponent,
    DiazoNodeComponent,
    DiazoNodeHostComponent,
    DiazoSlotComponent,
    DiazoEditorComponent,
    DiazoNodeSourceComponent,
    CustomPropertyEditorHostComponent,
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