/** RenderSettings contains how the scene should be renderer 
* There could be different renderSettings for different scene quality.
* @class RenderSettings
* @constructor
**/

function RenderSettings( o )
{
	this.renderer_name = null; //null means default

	//global render settings
	this.default_shadowmap_resolution = LS.RenderSettings.default_shadowmap_resolution; //let the system decide best shadowmap resolution according to quality settings
	this.ignore_viewports = false;	//render to full viewport, ignoring the viewport in the cameras
	this.ignore_clear = false;	//skip global clear, used in case you want to mix LiteScene with another renderer
	this.keep_viewport = false; //do not force a full canvas viewport at render start (use the current one in WebGL as the full)
	this.linear_pipeline = false; //tries to degamma all the albedo textures.

	this.shadows_enabled = true; //allow shadowmaps
	this.update_shadowmaps = true; //automatically update shadowmaps in every frame (enable if there are dynamic objects)
	this.update_all_shadowmaps = false; //update shadowmaps even if they are not visible

	this.force_wireframe = false; //render everything in wireframe
	this.lights_disabled = false; //flat lighting
	this.low_quality = false;	//try to use low quality shaders (where available)

	this.update_materials = true; //update info in materials in every frame
	this.render_all_cameras = true; //render secundary cameras too
	this.render_fx = true; //postprocessing fx
	this.render_gui = true; //render gui
	this.render_helpers = true; //render helpers (for the editor)

	this.layers = 0xFF; //this is masked with the camera layers when rendering

	this.sort_instances_by_distance = true; //sort render instances by distance 
	this.sort_instances_by_priority = true; //sort render instances by priority
	this.z_pass = false; //enable when the shaders are too complex (normalmaps, etc) to reduce work of the GPU (still some features missing)
	this.frustum_culling = true; //test bounding box by frustum to determine visibility
	this.depth_test = true;	//do depth test when rendering

	this.clipping_plane = null;

	//info
	this.in_player = true; //is in the player (not in the editor)

	//this should change one day...
	this.default_shader_id = "global";
	this.default_low_shader_id = "lowglobal";

	if(o)
		this.configure(o);
}

RenderSettings.default_shadowmap_resolution = 1024;

RenderSettings["@default_shadowmap_resolution"] = { widget: "combo", values: [0,256,512,1024,2048,4096] };
RenderSettings["@layers"] = { type: "layers" };

RenderSettings.prototype.serialize = function()
{
	return LS.cloneObject(this);
}

RenderSettings.prototype.configure = function(o)
{
	if(o)
		for(var i in o)
			this[i] = o[i];

	//legacy
	if(this.layers === null)
		this.layers = 0xFF;
}

RenderSettings.prototype.toJSON = RenderSettings.prototype.serialize;

LS.RenderSettings = RenderSettings;