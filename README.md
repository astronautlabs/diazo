# Firegraph

An MIT-licensed directed-acyclical-graph (DAG) editor for Angular. This 
component was built for use in Astronaut Labs' Livefire product suite because 
there was no good existing open-source editor. We wanted to fix that, so we 
hope you find lots of great ways to use this editor in your projects!

# Usage

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

## How do I use it?

There's no documentation just yet! Make sure to Star the project to keep up 
with how this evolves!