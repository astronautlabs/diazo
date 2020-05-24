# Firegraph

An MIT-licensed slot-driven directed-acyclical-graph (DAG) editor for Angular. This 
component was built for use in Astronaut Labs' Livefire product suite because 
there was no good existing open-source editor. We wanted to fix that, so we 
hope you find lots of great ways to use this editor in your projects!

Firegraph is inspired by Blueprint, the visual programming language of 
Unreal Engine. Firegraph itself is just the editor that would power such
an experience, and the library itself is completely domain-agnostic. 
You can use Firegraph in your apps to introduce visual node-graph functionality 
in any domain where it makes sense to apply it, and we encourage you to do so!

# Installation

Firegraph uses Angular Material. Make sure it is installed before continuing:

```
ng add @angular/material
```

Firegraph also depends on `ngx-monaco-editor` (an Angular package for using 
Microsoft's Monaco code editor component):

```
npm i ngx-monaco-editor @astronautlabs/firegraph
```

Now add FiregraphModule to your Angular module's list of imports:

```typescript
@NgModule({
    // ....
    imports: [
        // ...
        FiregraphModule,
        // ...
    ]
})
export class AppModule {
}
```

# Concepts

Firegraph operates on a simple directed-acyclical-graph (DAG) data structure 
which is transparently available to you as the consumer of the library. The 
DAG is specified as a set of nodes with distinct IDs which each specify a set of
input and output slots. The DAG also tracks a set of edges which
link one slot on a particular node to another slot on a different node. 

# Usage

```html
    <fg-editor
        [graph]="myGraph"
        [availableNodes]="availableNodes"
        ></fg-editor>
```

There are many more bindable properties and events that `<fg-editor>` makes 
available, but the above are what's needed to provide a basic experience.

## `[graph]="myGraph"`

The most important input to Firegraph is the graph object itself. The graph 
object specifies the nodes and edges that make up the graph you can see in 
the editor.

One might satisfy this binding by declaring `myGraph` as seen below.
```typescript
import { Firegraph } from '@astronautlabs/firegraph';

export class MyComponent {
    myGraph : Firegraph = { nodes: [], edges: [] };
}
```

