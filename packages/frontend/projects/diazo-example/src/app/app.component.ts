import { Component } from '@angular/core';
import { DiazoGraph, DiazoNodeSet, DiazoContext, DiazoNode } from 'diazo';
import { MatSnackBar } from '@angular/material/snack-bar';

function range<T>(count: number, maker: (index: number) => T): T[] {
  let array: T[] = [];
  for (let i = 0, max = count; i < max; ++i) {
    array.push(maker(i));
  }

  return array;
}

const HEAVY_SET: DiazoNode[] = range(10, i => (
  {
    id: `id_${i}`,
    data: { 
      unit: 'my-input',
      textProperty: 'hello'
    },
    label: 'My Input',
    x: i * 100, 
    y: 0,
    slots: [
      { id: 'output', type: 'output', label: 'Output' }
    ]
  }
));

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
    edges: [], 
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
                slots: [
                    { id: 'input', type: 'input', label: 'Input' }
                ]
            }
        ]
    }
]
}
