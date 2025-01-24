import { Component } from '@angular/core';
import { DiazoGraph, DiazoNodeSet, DiazoContext, DiazoNode, DiazoEdge } from 'diazo';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';

function range<T>(count: number, maker: (index: number) => T): T[] {
  let array: T[] = [];
  for (let i = 0, max = count; i < max; ++i) {
    array.push(maker(i));
  }

  return array;
}

const HEAVY_SET: DiazoNode[] = range(10, i => (
  <DiazoNode>{
    id: `id_${i}`,
    data: { 
      unit: 'my-input',
      textProperty: 'hello'
    },
    compact: true,
    style: 'inline',
    profile: 'wide',
    label: 'My Input',
    x: i * 100, 
    y: i * 100,
    slots: [
      { id: 'input', type: 'input', label: 'Input' },
      { id: 'output', type: 'output', label: 'Output' }
    ]
  }
));

const HEAVY_EDGES: DiazoEdge[] = range(5, i => (
  <DiazoEdge>{
    fromNodeId: `id_${i}`,
    toNodeId: `id_${i+1}`,
    fromSlotId: `output`,
    toSlotId: `input`,
    active: i === 1
  }
))


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private matSnackbar : MatSnackBar
  ) {

  }
  readonly = false;
  active = false;
  graphContext : DiazoContext;
  dirty = false;

  onSaveRequested() {
    if (this.dirty) {
      this.dirty = false;
      this.matSnackbar.open(
        "Pretending to save your changes!", 
        undefined, {
          duration: 1000
        }
      );
    } else {
      this.matSnackbar.open(
        "No changes need to be saved!", 
        undefined, 
        {
          duration: 1000
        }
      );
    }
  }

  onContextChanged(context : DiazoContext) {
    this.graphContext = context;
  }

  onGraphChanged(graph : DiazoGraph) {
    this.dirty = true;
  }

  freeID = 0;
  myGraph : DiazoGraph = {
    edges: HEAVY_EDGES, 
    nodes: HEAVY_SET
  };
  
  availableNodes : DiazoNodeSet[] = [
    {
        id: 'general',
        label: 'General',
        nodes: [
            {
                data: {
                    unit: 'my-input',
                    someProperty: 'abc'
                },
                label: 'My Input',
                slots: [
                    { id: 'output', type: 'output', label: 'Output' }
                ],
                properties: [
                    {
                        id: 'output-options',
                        label: 'Output Options',
                        properties: [
                          {
                              type: 'text',
                              path: '$.data.textProperty',
                              label: 'A Text Property',
                              description: 'This is an example of a text property!'
                          },
                          {
                              type: 'json',
                              path: '$.data.jsonProperty',
                              label: 'A JSON Property',
                              description: 'This is an example of a JSON property!'
                          }
                        ]
                    }
                ]
            },
            {
                data: {
                    unit: 'my-output'
                },
                label: 'My Output',
                catalog: {
                  label: 'My Output!',
                  icon: 'public'
                },
                icon: 'home',
                slots: [
                    { id: 'input', type: 'input', label: 'Input' }
                ]
            },
            {
                data: {
                    unit: 'my-filter'
                },
                label: 'My Filter',
                profile: 'wide',
                slots: [
                  { id: 'inputA', type: 'input', label: 'Input A' },
                  { id: 'inputB', type: 'input', label: 'Input B', invalid: true, removeWhenEmpty: true },
                  { id: 'outputA', type: 'output', label: 'Output A' },
                  { id: 'outputB', type: 'output', label: 'Output B' }
                ]
            }
        ]
    }
]
}
