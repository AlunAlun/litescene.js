


//Material class **************************
/**
* A Material is a class in charge of defining how to render an object, there are several classes for Materials
* but this class is more like a template for other material classes.
* @namespace LS
* @class Material
* @constructor
* @param {String} object to configure from
*/

function Material(o)
{
	this.uid = LS.generateUId("MAT-");
	this._dirty = true;

	this._color = new Float32Array([1.0,1.0,1.0,1.0]);
	this.createProperty( "diffuse", new Float32Array([1.0,1.0,1.0]), "color" );
	this.blend_mode = LS.Blend.NORMAL;

	//flags
	this.alpha_test = false;
	this.alpha_test_shadows = false;

	//textures
	this.uvs_matrix = new Float32Array([1,0,0, 0,1,0, 0,0,1]);
	this.textures = {};

	this._query = new ShaderQuery();

	//properties with special storage (multiple vars shared among single properties)

	Object.defineProperty( this, 'color', {
		get: function() { return this._color.subarray(0,3); },
		set: function(v) { vec3.copy( this._color, v ); },
		enumerable: true
	});

	Object.defineProperty( this, 'opacity', {
		get: function() { return this._color[3]; },
		set: function(v) { this._color[3] = v; },
		enumerable: true
	});

	if(o) 
		this.configure(o);
}

Material["@color"] = { type:"color" };
Material["@blend_mode"] = { type: "enum", values: LS.Blend };

Material.icon = "mini-icon-material.png";


//material info attributes, use this to avoid errors when settings the attributes of a material

/**
* Surface color
* @property color
* @type {vec3}
* @default [1,1,1]
*/
Material.COLOR = "color";
/**
* Opacity. It must be < 1 to enable alpha sorting. If it is <= 0 wont be visible.
* @property opacity
* @type {number}
* @default 1
*/
Material.OPACITY = "opacity";

/**
* Blend mode, it could be any of Blend options (NORMAL,ALPHA, ADD, SCREEN)
* @property blend_mode
* @type {String}
* @default Blend.NORMAL
*/
Material.BLEND_MODE = "blend_mode";

Material.SPECULAR_FACTOR = "specular_factor";
/**
* Specular glossiness: the glossines (exponent) of specular light
* @property specular_gloss
* @type {number}
* @default 10
*/
Material.SPECULAR_GLOSS = "specular_gloss";


Material.OPACITY_TEXTURE = "opacity";	//used for baked GI
Material.COLOR_TEXTURE = "color";	//material color
Material.AMBIENT_TEXTURE = "ambient";
Material.SPECULAR_TEXTURE = "specular"; //defines specular factor and glossiness per pixel
Material.EMISSIVE_TEXTURE = "emissive";
Material.ENVIRONMENT_TEXTURE = "environment";

Material.COORDS_UV0 = "0";
Material.COORDS_UV1 = "1";
Material.COORDS_UV_TRANSFORMED = "transformed";
Material.COORDS_SCREEN = "screen";					//project to screen space
Material.COORDS_SCREENCENTERED = "screen_centered";	//project to screen space and centers and corrects aspect
Material.COORDS_FLIPPED_SCREEN = "flipped_screen";	//used for realtime reflections
Material.COORDS_POLAR = "polar";					//use view vector as polar coordinates
Material.COORDS_POLAR_REFLECTED = "polar_reflected";//use reflected view vector as polar coordinates
Material.COORDS_POLAR_VERTEX = "polar_vertex";		//use normalized vertex as polar coordinates
Material.COORDS_WORLDXZ = "worldxz";
Material.COORDS_WORLDXY = "worldxy";
Material.COORDS_WORLDYZ = "worldyz";

Material.TEXTURE_COORDINATES = [ Material.COORDS_UV0, Material.COORDS_UV1, Material.COORDS_UV_TRANSFORMED, Material.COORDS_SCREEN, Material.COORDS_SCREENCENTERED, Material.COORDS_FLIPPED_SCREEN, Material.COORDS_POLAR, Material.COORDS_POLAR_REFLECTED, Material.COORDS_POLAR_VERTEX, Material.COORDS_WORLDXY, Material.COORDS_WORLDXZ, Material.COORDS_WORLDYZ ];
Material.DEFAULT_UVS = { "normal":Material.COORDS_UV0, "displacement":Material.COORDS_UV0, "environment": Material.COORDS_POLAR_REFLECTED, "irradiance" : Material.COORDS_POLAR };

Material.available_shaders = ["default","global","lowglobal","phong_texture","flat","normal","phong","flat_texture","cell_outline"];
Material.texture_channels = []; //base material doesnt support any texture

Material.prototype.applyToRenderInstance = function(ri)
{
	if(this.blend_mode != LS.Blend.NORMAL)
		ri.flags |= RI_BLEND;

	if(this.blend_mode == LS.Blend.CUSTOM && this.blend_func)
		ri.blend_func = this.blend_func;
	else
		ri.blend_func = LS.BlendFunctions[ this.blend_mode ];
}

// RENDERING METHODS
Material.prototype.fillShaderQuery = function(scene)
{
	var query = this._query;
	query.clear();

	//iterate through textures in the material
	for(var i in this.textures) 
	{
		var sampler = this.getTextureSampler(i);
		if(!sampler)
			continue;
		var uvs = sampler.uvs || Material.DEFAULT_UVS[i] || "0";

		var texture = Material.getTextureFromSampler( sampler );
		if(!texture) //loading or non-existant
			continue;

		query.macros[ "USE_" + i.toUpperCase() + (texture.texture_type == gl.TEXTURE_2D ? "_TEXTURE" : "_CUBEMAP") ] = "uvs_" + uvs;
	}

	//if(this.reflection_factor > 0.0) 
	//	macros.USE_REFLECTION = "";	

	//extra macros
	if(this.extra_macros)
		for(var im in this.extra_macros)
			query.macros[im] = this.extra_macros[im];
}

Material.prototype.fillUniforms = function( scene, options )
{
	var uniforms = {};
	var samplers = [];

	uniforms.u_material_color = this._color;
	uniforms.u_ambient_color = scene.info ? scene.info.ambient_color : this._diffuse;
	//uniforms.u_diffuse_color = this._diffuse;
	uniforms.u_texture_matrix = this.uvs_matrix;

	uniforms.u_specular = vec2.create([1,50]);
	uniforms.u_reflection = 0.0;

	//iterate through textures in the material
	var last_texture_slot = 0;
	for(var i in this.textures) 
	{
		var sampler = this.getTextureSampler(i);
		if(!sampler)
			continue;

		var texture = Material.getTextureFromSampler( sampler );
		if(!texture) //loading or non-existant
			continue;

		samplers[ last_texture_slot ] = sampler;
		var uniform_name = i + (texture.texture_type == gl.TEXTURE_2D ? "_texture" : "_cubemap");
		uniforms[ uniform_name ] = last_texture_slot;
		last_texture_slot++;
	}

	//add extra uniforms
	for(var i in this.extra_uniforms)
		uniforms[i] = this.extra_uniforms[i];

	this._uniforms = uniforms;
	this._samplers = samplers; //samplers without fixed slot
}

/**
* Configure the material getting the info from the object
* @method configure
* @param {Object} object to configure from
*/
Material.prototype.configure = function(o)
{
	for(var i in o)
	{
		if(!this.setProperty( i, o[i] ) && LS.debug)
			console.warn("Material property not assigned: " + i );
	}
}

/**
* Serialize this material 
* @method serialize
* @return {Object} object with the serialization info
*/
Material.prototype.serialize = function()
{
	 var o = LS.cloneObject(this);
	 o.material_class = LS.getObjectClassName(this);
	 return o;
}


/**
* Clone this material (keeping the class)
* @method clone
* @return {Material} Material instance
*/
Material.prototype.clone = function()
{
	var data = this.serialize();
	if(data.uid)
		delete data.uid;
	return new this.constructor( JSON.parse( JSON.stringify( data )) );
}

/**
* Loads and assigns a texture to a channel
* @method loadAndSetTexture
* @param {Texture || url} texture_or_filename
* @param {String} channel
*/
Material.prototype.loadAndSetTexture = function(channel, texture_or_filename, options)
{
	options = options || {};
	var that = this;
	//if(!this.material) this.material = new Material();

	if( typeof(texture_or_filename) === "string" ) //it could be the url or the internal texture name 
	{
		if(texture_or_filename[0] != ":")//load if it is not an internal texture
			LS.ResourcesManager.load(texture_or_filename,options, function(texture) {
				that.setTexture(channel, texture);
				if(options.on_complete)
					options.on_complete();
			});
		else
			this.setTexture(channel, texture_or_filename);
	}
	else //otherwise just assign whatever
	{
		this.setTexture(channel, texture_or_filename);
		if(options.on_complete)
			options.on_complete();
	}
}

/**
* gets all the properties and its types
* @method getPropertiesInfo
* @return {Object} object with name:type
*/
Material.prototype.getPropertiesInfo = function()
{
	var o = {
		color:"vec3",
		opacity:"number",
		blend_mode: "number",
		alpha_test:"boolean",
		alpha_test_shadows:"boolean",
		uvs_matrix:"mat3"
	};

	var textures = this.getTextureChannels();
	for(var i in textures)
		o["tex_" + textures[i]] = "Texture"; //changed from Sampler
	return o;
}

/**
* gets all the properties and its types
* @method getProperty
* @return {Object} object with name:type
*/
Material.prototype.getProperty = function(name)
{
	if(name.substr(0,4) == "tex_")
		return this.textures[ name.substr(4) ];
	return this[name];
}


/**
* gets all the properties and its types
* @method getProperty
* @return {Object} object with name:type
*/
Material.prototype.setProperty = function( name, value )
{
	if(name.substr(0,4) == "tex_")
	{
		if( (value && (value.constructor === String || value.constructor === GL.Texture)) || !value)
			this.setTexture( name.substr(4), value );
		return true;
	}

	switch(name)
	{
		//numbers
		case "opacity": 
		case "specular_factor":
		case "specular_gloss":
		case "reflection": 
			if(value.constructor === Number)
				this[name] = value; 
			break;
		//bools
		//strings
		case "alpha_test":
		case "alpha_test_shadows":
		case "blend_mode":
			this[name] = value; 
			break;
		//vectors
		case "uvs_matrix":
		case "color": 
			if(this[name].length == value.length)
				this[name].set( value );
			break;
		case "textures":
			//legacy
			for(var i in value)
			{
				var tex = value[i];
				if(typeof(tex) == "string")
					tex = { texture: tex, uvs: "0", wrap: 0, minFilter: 0, magFilter: 0 };
				this.textures[i] = tex;
			}
			//this.textures = cloneObject(value);
			break;
		case "transparency": //special cases
			this.opacity = 1 - value;
			break;
		default:
			return false;
	}
	return true;
}

Material.prototype.setPropertyValueFromPath = function( path, value, offset )
{
	offset = offset || 0;

	if( path.length < (offset+1) )
		return;

	//maybe check if path is texture?
	//TODO

	//assign
	this.setProperty( path[ offset ], value );
}

Material.prototype.getPropertyInfoFromPath = function( path )
{
	if( path.length < 1)
		return;

	var varname = path[0];
	var type = null;

	switch(varname)
	{
		case "opacity": 
		case "transparency":
		case "specular_factor":
		case "specular_gloss":
		case "reflection": 
		case "blend_mode":
			type = "number"; break;
		//bools
		case "alpha_test":
		case "alpha_test_shadows":
			type = "boolean"; break;
		//vectors
		case "uvs_matrix":
			type = "mat3"; break;
		case "color": 
			type = "vec3"; break;
		case "textures":
			type = "Texture"; break;
		default:
			return null;
	}

	return {
		node: this._root,
		target: this,
		name: varname,
		value: this[varname],
		type: type
	};
}

/**
* gets all the texture channels supported by this material
* @method getTextureChannels
* @return {Array} array with the name of every channel supported by this material
*/
Material.prototype.getTextureChannels = function()
{
	if(this.constructor.texture_channels)
		return this.constructor.texture_channels;
	return [];
}

/**
* Assigns a texture to a channel and its sampling parameters
* @method setTexture
* @param {String} channel for a list of supported channels by this material call getTextureChannels()
* @param {Texture} texture
* @param {Object} sampler_options
*/
Material.prototype.setTexture = function( channel, texture, sampler_options ) {
	if(!channel)
		throw("Material.prototype.setTexture channel must be specified");

	if(!texture)
	{
		delete this.textures[channel];
		return;
	}

	var sampler = this.textures[channel];
	if(!sampler)
		this.textures[channel] = sampler = { texture: texture, uvs: Material.DEFAULT_UVS[channel] || "0", wrap: 0, minFilter: 0, magFilter: 0 };
	else if(sampler.texture == texture)
		return sampler;
	else
		sampler.texture = texture;

	if(sampler_options)
		for(var i in sampler_options)
			sampler[i] = sampler_options[i];

	if(texture.constructor === String && texture[0] != ":")
		LS.ResourcesManager.load(texture);

	return sampler;
}

/**
* Set a property of the sampling (wrap, uvs, filter)
* @method setTextureProperty
* @param {String} channel for a list of supported channels by this material call getTextureChannels()
* @param {String} property could be "uvs", "filter", "wrap"
* @param {*} value the value, for uvs check Material.TEXTURE_COORDINATES, filter is gl.NEAREST or gl.LINEAR and wrap gl.CLAMP_TO_EDGE, gl.MIRROR or gl.REPEAT
*/
Material.prototype.setTextureProperty = function( channel, property, value )
{
	var sampler = this.textures[channel];

	if(!sampler)
	{
		if(property == "texture")
			this.textures[channel] = sampler = { texture: value, uvs: Material.DEFAULT_UVS[channel] || "0", wrap: 0, minFilter: 0, magFilter: 0 };
		return;
	}

	sampler[ property ] = value;
}

/**
* Returns the texture in a channel
* @method getTexture
* @param {String} channel default is COLOR
* @return {Texture}
*/
Material.prototype.getTexture = function( channel ) {
	channel = channel || Material.COLOR_TEXTURE;

	var v = this.textures[channel];
	if(!v) 
		return null;

	if(v.constructor === String)
		return LS.ResourcesManager.textures[v];

	var tex = v.texture;
	if(!tex)
		return null;
	if(tex.constructor === String)
		return LS.ResourcesManager.textures[tex];
	else if(tex.constructor == Texture)
		return tex;
	return null;
}

/**
* Returns the texture sampler info of one texture channel (filter, wrap, uvs)
* @method getTextureSampler
* @param {String} channel get available channels using getTextureChannels
* @return {Texture}
*/
Material.prototype.getTextureSampler = function(channel) {
	return this.textures[ channel ];
}

Material.getTextureFromSampler = function(sampler)
{
	var texture = sampler.constructor === String ? sampler : sampler.texture;
	if(!texture) //weird case
		return null;

	//fetch
	if(texture.constructor === String)
		texture = LS.ResourcesManager.textures[ texture ];
	
	if (!texture || texture.constructor != GL.Texture)
		return null;
	return texture;
}

/**
* Assigns a texture sampler to one texture channel (filter, wrap, uvs)
* @method setTextureInfo
* @param {String} channel default is COLOR
* @param {Object} sampler { texture, uvs, wrap, filter }
*/
Material.prototype.setTextureSampler = function(channel, sampler) {
	if(!channel)
		throw("Cannot call Material setTextureSampler without channel");
	if(!sampler)
		delete this.textures[ channel ];
	else
		this.textures[ channel ] = sampler;
}

/**
* Collects all the resources needed by this material (textures)
* @method getResources
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
Material.prototype.getResources = function (res)
{
	for(var i in this.textures)
	{
		var sampler = this.textures[i];
		if(!sampler) 
			continue;
		if(typeof(sampler.texture) == "string")
			res[ sampler.texture ] = GL.Texture;
	}
	return res;
}

/**
* Event used to inform if one resource has changed its name
* @method onResourceRenamed
* @param {Object} resources object where all the resources are stored
* @return {Texture}
*/
Material.prototype.onResourceRenamed = function (old_name, new_name, resource)
{
	for(var i in this.textures)
	{
		var sampler = this.textures[i];
		if(!sampler)
			continue;
		if(sampler.texture == old_name)
			sampler.texture = new_name;
	}
}

/**
* Loads all the textures inside this material, by sending the through the ResourcesManager
* @method loadTextures
*/

Material.prototype.loadTextures = function ()
{
	var res = this.getResources({});
	for(var i in res)
		LS.ResourcesManager.load( i );
}

/**
* Register this material in a materials pool to be shared with other nodes
* @method registerMaterial
* @param {String} name name given to this material, it must be unique
*/
Material.prototype.registerMaterial = function(name)
{
	this.name = name;
	LS.ResourcesManager.registerResource(name, this);
	this.material = name;
}

Material.prototype.getCategory = function()
{
	return this.category || "Material";
}

Material.prototype.updatePreview = function(size, options)
{
	options = options || {};

	var res = {};
	this.getResources(res);

	for(var i in res)
	{
		var resource = LS.ResourcesManager.resources[i];
		if(!resource)
		{
			console.warn("Cannot generate preview with resources missing.");
			return null;
		}
	}

	if(LS.GlobalScene.info.textures.environment)
		options.environment = LS.GlobalScene.info.textures.environment;

	size = size || 256;
	var preview = LS.Renderer.renderMaterialPreview( this, size, options );
	if(!preview)
		return;

	this.preview = preview;
	if(preview.toDataURL)
		this._preview_url = preview.toDataURL("image/png");
}

Material.prototype.getLocator = function()
{
	if(this._root)
		return this._root.uid + "/material";
	return this.uid;
}

Material.processShaderCode = function(code)
{
	var lines = code.split("\n");
	for(var i in lines)
		lines[i] = lines[i].split("//")[0]; //remove comments
	code = lines.join("");
	if(!code)
		return null;
	return code;
}

/**
* Creates a new property in this material class, but helps with some special cases
* like when we have a Float32Array property and we dont want it to be replaced by another array, but setted
* @method createProperty
* @param {String} name the property name as it should be accessed ( p.e.  "color" -> material.color )
* @param {*} value
* @param {String} type a valid value type ("Number","Boolean","Texture",...)
*/
Material.prototype.createProperty = function( name, value, type, options )
{
	if(type)
	{
		LS.validatePropertyType(type);
		this.constructor[ "@" + name ] = { type: type };
	}

	if(options)
	{
		if(!this.constructor[ "@" + name ])
			this.constructor[ "@" + name ] = {};
		LS.cloneObject( options, this.constructor[ "@" + name ] );
	}

	//basic type
	if(value.constructor === Number || value.constructor === String || value.constructor === Boolean)
	{
		this[ name ] = value;
		return;
	}

	//vector type
	if(value.constructor === Float32Array)
	{
		var private_name = "_" + name;
		value = new Float32Array( value ); //clone
		this[ private_name ] = value; //this could be removed...

		Object.defineProperty( this, name, {
			get: function() { return value; },
			set: function(v) { value.set( v ); },
			enumerable: true
		});
	}
}

Material.prototype.prepareMaterial = function( scene )
{
	if(!this._uniforms)
	{
		this._uniforms = {};
		this._samplers = [];
	}
	this.fillShaderQuery( scene ); //update shader macros on this material
	this.fillUniforms( scene ); //update uniforms
}


//LS.registerMaterialClass( Material );
LS.registerResourceClass( Material );
LS.Material = Material;