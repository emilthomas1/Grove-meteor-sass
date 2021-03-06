var path = Npm.require('path');
var sass = Npm.require('node-sass');
var fs   = Npm.require('fs');
var _    = Npm.require('lodash');

var autoprefixer = Npm.require('autoprefixer-core');

var generatedMessage = [
  "// This file is auto generated by the scss package",
  "// New .scss and .sass files will be automatically '@import'ed  at the bottom",
  "// Existing content in the file will not be touched",
  "// When deleting a .scss or .sass file you must manually delete it from here",
  "",
  ""
].join("\n");

var loadJSONFile = function (filePath) {
  var content = fs.readFileSync(filePath);
  try {
    return JSON.parse(content);
  }
  catch (e) {
    console.log("Error: failed to parse ", filePath, " as JSON");
    return {};
  }
};

var sourceHandler = function(compileStep) {
  // Don't process partials
  if ( path.basename(compileStep.inputPath)[0] === '_' ) 
    return;
  // XXX annoying that this is replicated in .css, .less, and .styl

  var optionsFile = path.join(process.cwd(), 'scss.json');
  var scssOptions = {};
  var sourceMap   = null;

  if (fs.existsSync(optionsFile)) {
    scssOptions = loadJSONFile(optionsFile);
  }

  if ( scssOptions.useIndex ) {
    var indexFilePath = scssOptions.indexFilePath || "index.scss";
    // If this isn't the index file, add it to the index if need be
    if ( compileStep.inputPath != indexFilePath ) {
      if ( fs.existsSync(indexFilePath) ) {
        var scssIndex = fs.readFileSync(indexFilePath, 'utf8');
        if (scssIndex.indexOf(compileStep.inputPath) == -1) {
          fs.appendFileSync(indexFilePath, '\n@import "' + compileStep.inputPath + '";', 'utf8');
        }  
      } else {
        var newFile = generatedMessage + '@import "' + compileStep.inputPath + '";\n';
        fs.writeFileSync(indexFilePath, newFile, 'utf8');
      }
      return; // stop here, only compile the indexFile
    }
  }

  var options = _.extend(scssOptions, {
    sourceMap:     false,
    outputStyle:   'compressed'
  });

  options.file  = compileStep.fullInputPath;

  if ( !_.isArray(options.includePaths) ) {
    options.includePaths = [options.includePaths];
  }

  options.includePaths = options.includePaths.concat(path.dirname(compileStep.fullInputPath));

  var result;
  try {
    result = sass.renderSync(options);
  } catch (error) {
    e = JSON.parse(error);  // error should be an object, not a string, if using render
                            // guess it hasn't been implemented for renderSync
    return compileStep.error({
      message: "Scss compiler error: " + e.message + "\n",
      sourcePath: e.file || compileStep.inputPath,
      line: e.line,
      column: e.column
    });
  }

  if ( options.enableAutoprefixer || 
  (compileStep.fileOptions && compileStep.fileOptions.isTest) ) {
    var autoprefixerOptions = options.autoprefixerOptions || {};

    try {
      // Applying Autoprefixer to compiled css
      var processor = autoprefixer(autoprefixerOptions);
      result.css = processor.process(result.css).css;
    } catch (e) {
      compileStep.error({
        message: "Autoprefixer error: " + e,
        sourcePath: e.filename || compileStep.inputPath
      });
    }
  }

  if (options.sourceComments !== 'none') {
    // The following is disabled until 2.0.0-beta2

    // sourceMap = JSON.parse(css.sourceMap);
    // delete sourceMap.file;
    // sourceMap.file = compileStep.pathForSourceMap;
    // sourceMap.sources = [compileStep.inputPath];
    // sourceMap.sourcesContent = [compileStep.read().toString('utf8')];
  }

  compileStep.addStylesheet({
    path: compileStep.inputPath + ".css",
    data: result.css
    // sourceMap: JSON.stringify(sourceMap)
  });
};

Plugin.registerSourceHandler("scss", {archMatching: 'web'}, sourceHandler);
Plugin.registerSourceHandler("sass", {archMatching: 'web'}, sourceHandler);

Plugin.registerSourceHandler("scssimport", function () {
  // Do nothing
});
