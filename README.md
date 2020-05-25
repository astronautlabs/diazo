# diazo
[Documentation](https://astronautlabs.github.io/diazo/) | [Example](https://astronautlabs.github.io/diazo-example/)

An MIT-licensed slot-driven directed-acyclical-graph (DAG) editor for Angular. This 
component was built for use in Astronaut Labs' Livefire product suite because 
there was no good existing open-source editor. We wanted to fix that, so we 
hope you find lots of great ways to use this editor in your projects!

Diazo is inspired by Blueprint, the visual programming language of 
Unreal Engine. Diazo itself is just the editor that would power such
an experience, and the library itself is completely domain-agnostic. 
You can use Diazo in your apps to introduce visual node-graph functionality 
in any domain where it makes sense to apply it, and we encourage you to do so!

# Getting Started

Diazo uses Angular Material. Make sure it is installed before continuing:

```
ng add @angular/material
```

Diazo also depends on `ngx-monaco-editor` (an Angular package for using 
Microsoft's Monaco code editor component):

```
npm i ngx-monaco-editor @astronautlabs/diazo
```

Now add DiazoModule to your Angular module's list of imports:

```typescript
@NgModule({
    // ....
    imports: [
        // ...
        DiazoModule,
        // ...
    ]
})
export class AppModule {
}
```

## Working on Diazo

- `npm run build` to build the library
- `npm run docs` to generate documentation
- `cd dist ; npm link` to make your local built copy of the library available
  for applications you are testing it with
- use `npm link @astronautlabs/diazo` within your test app's folder to link 
  your local copy of diazo into the environment.
- `cd dist ; npm publish` to publish the library