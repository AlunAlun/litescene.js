# Scripting #

LiteScene allows to run scripts so users can code the behaviour of the application.

The info about the scripts is stored inside the scene so when a new scene is loaded it loads its scripts too.

There are several ways to interact programmatically with LiteScene, every method is better suited for different purposes.

## Using script components ##

This is the easiest way. You can attach a Script or a ScriptFromFile component to any node. The difference between both is that Script stores the code inside the component while ScriptFromFile references the code from a resource file (better suited when sharing the same behaviour among different nodes or projects).

ScriptFromFile behave as regular Scripts but because its load is asynchromous it means their context will be created later in time after the scene has started, keep that in mind (events like start will me called once the node is loaded).

### The script context ###

Every script has its own execution context usually referred as the script context.

The context is created when the component is configured and the code loaded.

To access the context of a script component just access the context property:

```javascript
script_component.context.foo = 10;
```

### Local vars and functions ###

Every ```var``` (or ```function```) defined in that scope is local to the context so it cannot be accesed from outside of the scope.

Unless we make it public or we make a setter/getter.

### Public vars ###

If the user wants to make local vars or methods accesible from other scripts, graphs or animation tracks  (or the editor), they need to be made public, to do so they must be attached to the context itself:

```javascript
this.number = 1; //this var will be public
```

Sometimes may be helpful to specify the type of the var to the system, this way the var can be properly connected using Graphs, or animated using Animation Tracks.
In that case the user can use:

```javascript
this.createProperty("myvar", [1,1,1], LS.TYPES.VEC3 );
```

Specifying types is important when the types are not basic types, and if you are using WebGLStudio the system will create appropiate widgets to interact with them.

Also, when using WebGLStudio, there is also the option to specify widget properties to have a better UI for this script:

```javascript
this.createProperty("myvar", 0, {type: "number", widget:"slider", min:0, max:100, step:1});
```

### Events ###

To interact with the system, scripts need to attach callbacks to events dispatched by the different elements of the scene, mostly by the scene (but could be the Renderer, the ResourcesManager, etc).
The number of events is too big to list here, check the different components documentation and the examples to see to which events you can bind to.
To bind an event you can call the bind method:

```javascript
this.bind( scene, "update", myfunction );
```

Keep in mind that myfunction must be a public method attached to the context (p.e. this.myfunc), otherwise the system wont be able to remove it automatically.

### API exported methods ###

However, there are some events that scripts usually want to use, like **start**, **init**, **render**, **update** and **finish**.
You do not need to bind (or unbind) those events, the Script component does it automatically if it detect a method in the context with an specific name (depending on the event):

```javascript
this.onUpdate = function(dt) { ... };
```

Here is a list of the automatically binded events:

- **onStart**: triggered by scene "start" event, remember that if your script is created after the scene starting you wont receive this.
- **onFinish**: triggered by scene "finish" event, used in the editor when the user stops the play mode.
- **onPrefabReady**: triggered by the node "prefabReady", used to access components or node that come from the prefab
- **onUpdate**: triggered by scene "update" event. it receives the delta time in seconds.
- **onClicked**: triggered by the node "clicked" event. Remember that you need an InteractiveController in the scene to dispatch this events.
- **onCollectRenderInstances**: triggered by node "collectRenderInstances" event. To pass RenderInstasnces
- **onSceneRender**: triggered by scene "beforeRender" event. Used to prepare stuff before any rendering is done.
- **onRender**: triggered by the node "beforeRenderInstances" event. Used to direct render stuff before the RenderInstances are rendered.
- **onAfterRender**: triggered by the node "afterRenderInstances" event. Used to direct render stuff after the RenderInstances are rendered.
- **onRenderHelpers**: triggered by scene "renderHelpers" event. To direct render stuff related to the editor.
- **onRenderGUI**: triggered by scene "renderGUI", to render stuff in 2D (using the canvas2D).
- **onEnableFrameContext**: triggered by the scene "enableFrameContext" event. Before rendering the final frame, used to setup a special RenderFrameContext and apply FX to the final image.
- **onShowFrameContext**: triggered by the scene "showFrameContext" event. After the final frame, to show the frame into the viewport.
- **onRemovedFromScene**: called when the node where the script belongs is detached from the scene.
- **onGetResources**: called when the script needs to collect resources. This function receives an object that needs to be filled with the fullpath : type of the resources it uses so they can be automatically loaded when the scene is loaded.

Keep in mind that you are free to bind to any events of the system that you want. Just remember to unbind them from the onRemovedFromScene so no lose binds are left.

### Serialization ###

Any data attached to the context whose name doesn't start with the character underscore "_" will be serialized automatically when storing the scene and restored when the context is created. Keep in mind that when serializing any property it is stored as a base type, so avoid setting public variables of special classes, only store properties of the common types like String, Number, Bool, or Arrays of basic types.

If you want to store stuff that shouldn't be serialized remember to use a name starting with underscore.

### Accessing other scripts from scripts ###

If you want to access data from the context of another script in the scene (or call a method), first you must retrieve that script context.

To do so the best way is to get the node from the scene, get the script component from that node, and get the context from that component.

```javascript
var node = scene.getNode("nodename");
var component = node.getComponent( LS.Components.Script ); //or ScriptFromFile, depending which component was used
var foo = component.context.foo; //read context property
```

Although you are free to register the components in some global container when the context is created so they are easier to retrieve.

### Script considerations ###

When coding scripts for LiteScene there are several things you must take into account:
- Remember to unbind every event you bind, otherwise the editor could have erratic behaviour.
- When using LS.Component.Script keep in mind that when the context is created (when your global code is executed) if you try to access to the scene tree to retrieve information (like nodes) it is possible that this info is not yet available because it hasnt been parsed yet.
- You can name the scripts by putting the name in the first like inside a comment like this: ```//@script_name ``` this may be useful if you are using the WebGLStudio editor as the name will be shown instead of the component class name.

## Global Scripts ##

Sometimes we want to create our own Components bypassing the scripts system, this is better because it will have better performance, more control and it will be easier to use by WebGLStudio.

But this scripts must be loaded **before** the scene is loaded. The problem with regular scripts is that they are parsed during the scene construction, this could lead to a ordering problem where a node is created using a component that is not yet defined.

To solve this problem and many others, scenes can include scripts that will be loaded before the scene tree is parsed. This are called global scripts, they are executed in the global context (window) like if they were external scripts, but the files are fetched using the ResourcesManager (so paths are relative to the resources manager root path).

Global scripts are stored in scene.global_scripts array.

## External Scripts ##

When we just want to load some external library to use in our code we can add it by appending the url to the external scripts array of the scene.

External scripts are stored in scene.external_scripts array.

## Editing LiteScene base code ##

The last option is to add new components to LiteScene by manually creating new component files and adding them to litescene.js.

To do that I will recommend to insert the components inside the components folder of the code structure.

You must add also the path to the component in the deploy_files.txt inside the utils, and run the script pack.sh (to create litescene.js) or build.sh (to create litescene.js and litescene.min.js).

## Documentation ##

To know more about the APIs accessible from LiteScene check the documation websites for LiteGL, LiteScene and LiteGraph.

