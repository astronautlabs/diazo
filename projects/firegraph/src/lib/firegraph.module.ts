import { NgModule } from "@angular/core";
import { FiregraphComponent } from './firegraph/firegraph.component';
import { FiregraphDynamicNodeComponent } from './firegraph-dynamic-node/firegraph-dynamic-node.component';
import { FiregraphNodeHostComponent } from './firegraph-node-host/firegraph-node-host.component';
import { FiregraphSlotComponent } from './firegraph-slot/firegraph-slot.component';
import { FiregraphNodeComponent } from './firegraph-node/firegraph-node.component';
import { CommonModule } from '@angular/common';
import { FiregraphEditorComponent } from './firegraph-editor/firegraph-editor.component';
import { FiregraphNodeSourceComponent } from './firegraph-node-source/firegraph-node-source.component';
import { TrustHtmlPipe } from './trust-html.pipe';
import { CustomPropertyEditorHostComponent } from './custom-property-editor-host/custom-property-editor-host.component';
import { OmnisearchPipe } from './omnisearch.pipe';
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

const DECLARATIONS = [
    OmnisearchPipe,
    FiregraphComponent,
    FiregraphDynamicNodeComponent,
    FiregraphNodeComponent,
    FiregraphNodeHostComponent,
    FiregraphSlotComponent,
    FiregraphEditorComponent,
    FiregraphNodeSourceComponent,
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
export class FiregraphModule {

}