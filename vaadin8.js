/**
 *  Exporter from model to Vaadin 8. Exports full project buildable with maven.
 *
 */
import v8Imports from "./v8_imports.js";

const kebabToPascalCase = str => {
  const parts = str.split("-");
  let result = "";
  for (const i in parts) {
    result = result.concat(parts[i][0].toUpperCase() + parts[i].slice(1));
  }
  return result;
};

const kebabToCamelCase = str => {
  const pascal = kebabToPascalCase(str).replace("/Vaadin/g", "");
  return pascal.charAt(0).toLowerCase() + pascal.substring(1);
};

export const exportToVaadin8 = project => {
  const zip = new JSZip();
  const designs = project.designs;
  const keys = Object.keys(designs);
  for (const i in keys) {
    const key = keys[i];
    const pascalCaseName = kebabToPascalCase(key);
    zip.file(
      "src/main/java/sketch/app/" + pascalCaseName + ".java",
      modelToVaadin8(pascalCaseName, designs[key].tree)
    );

    //    zip.file(
    //      `src/main/webapp/frontend/${pascalCaseName}.css`,
    //      designs[key].css
    //    );
  }
  // zip.file("src/main/java/sketch/app/UnideSplitPanel.java", unideSplitPanel);
  zip.file("pom.xml", pomXML);
  zip.file("src/main/webapp/VAADIN/themes/mytheme/styles.scss", stylesScss);
  zip.file("src/main/webapp/VAADIN/themes/mytheme/mytheme.scss", mythemeScss);
  zip.file("src/main/webapp/VAADIN/themes/mytheme/addons.scss", addonsScss);

  zip.generateAsync({ type: "blob" }).then(content => {
    saveAs(content, "vaadin8-sketch.zip");
  });
};

export const modelToVaadin8 = (pascalCaseName, code) => {
  const importedTags = new Set();
  let internalClasses = "";
  const stack = [];
  const tree = [];
  const variableStack = [];

  let current = document.createElement("div");
  let currentTag = "";
  let currentVar = "mainLayout";

  const varNames = {};

  importedTags.add("vaadin-vertical-layout");

  let result = "";
  code.forEach((str, index) => {
    const trimmed = str.trim();
    switch (trimmed) {
      case "(": {
        currentTag = stack.pop();
        const elementClass = v8Imports[currentTag]
          ? v8Imports[currentTag].name
          : kebabToPascalCase(currentTag);

        //Create an element in the DOM
        const old = current;
        tree.push(current);
        current = document.createElement(currentTag);
        old.appendChild(current);

        const varName = kebabToCamelCase(elementClass);
        let varCount = varNames[varName] || 0;
        varCount++;
        varNames[varName] = varCount;
        const newVar = varName + (varCount === 1 ? "" : varCount);
        console.log(`newvar : ${newVar} varname: ${varName}`);

        if (currentTag === "vaadin-split-layout") {
          if (
            code[index + 1] === "orientation" &&
            code[index + 2] === "vertical"
          ) {
            result += `VerticalSplitPanel ${newVar} = new VerticalSplitPanel();
            ${currentVar}.addComponent(${newVar});\n`;
          } else {
            result += `HorizontalSplitPanel ${newVar} = new HorizontalSplitPanel();
          ${currentVar}.addComponent(${newVar});\n`;
          }
        } else if (currentTag === "unide-grid") {
          result += `${elementClass}<${pascalCaseName}GridType> ${newVar} = new ${elementClass}<>();
          ${currentVar}.addComponent(${newVar});\n`;
        } else if (
          currentTag === "vaadin-tab" &&
          code[index + 1] == "textContent"
        ) {
          result += `${currentVar}.addTab(new VerticalLayout(), "${
            code[index + 2]
          }");\n`;
        } else {
          result += `${elementClass} ${newVar} = new ${elementClass}();
          ${currentVar}.addComponent(${newVar});\n`;
        }
        variableStack.push(currentVar);
        currentVar = newVar;

        if (currentTag in v8Imports) {
          importedTags.add(currentTag);
        }
        break;
      }
      case ")":
        current = tree.pop();
        currentVar = variableStack.pop();
        break;
      case "=": {
        const tos = stack.pop();
        const nos = stack.pop();
        if (!nos || !tos) {
          return;
        }

        if (currentTag === "unide-grid") {
          if (nos === "items") {
            const obj = JSON.parse(tos);
            let gridItems = ` ArrayList<${pascalCaseName}GridType> items = new ArrayList<>();
                              ${pascalCaseName}GridType item;\n`;
            obj.forEach(values => {
              let item = `item = new ${pascalCaseName}GridType();\n`;
              Object.keys(values).forEach(key => {
                item = item.concat(`item.set${key}("${values[key]}");`);
              });
              item = item.concat(`items.add(item);`);
              gridItems = gridItems.concat(item);
            });
            result = result
              .concat(gridItems)
              .concat(`${currentVar}.setItems(items);\n`);
            return;
          } else if (nos === "columnCaptions") {
            const obj = JSON.parse(tos);
            let methods = "";
            let fields = "";
            let creation = "";
            obj.forEach(pair => {
              creation = creation.concat(
                `${currentVar}.addColumn(${pascalCaseName}GridType::get${
                  pair.path
                }).setCaption("${pair.name}");\n`
              );
              fields = fields.concat(`private String ${pair.path};\n`);
              methods = methods.concat(`public String get${pair.path}() {
                  return this.${pair.path};
              }
              public void set${pair.path}(String value) {
                this.${pair.path}=value;
              }
                `);
            });

            internalClasses =
              internalClasses +
              `public static class ${pascalCaseName}GridType {
              ${fields}
              ${methods}
            }`;
            result = result.concat(creation);
            return;
          }
        } else if (currentTag === "vaadin-combo-box") {
          if (nos === "items") {
            result = result.concat(
              `${currentVar}.setItems(new String[]${tos
                .replace("[", "{")
                .replace("]", "}")});\n`
            );
          }
        }

        if (nos === "textContent" && currentTag != "vaadin-tab") {
          if (currentTag === "span") {
            result = result.concat(
              `${currentVar}.setValue("${tos.replace(/"/g, '\\"')}");\n`
            );
          } else {
            result = result.concat(
              `${currentVar}.setCaption("${tos.replace(/"/g, '\\"')}");\n`
            );
          }
        }
        break;
      }
      default:
        stack.push(trimmed);
    }
  });

  let importStrings = "";

  importedTags.forEach(tag => {
    importStrings = importStrings.concat(`${v8Imports[tag].import}\n`);
  });

  return `
  package sketch.app;
  
  import javax.servlet.annotation.WebServlet;

  import java.util.ArrayList;
  import com.vaadin.annotations.Theme;
  import com.vaadin.annotations.VaadinServletConfiguration;
  import com.vaadin.server.VaadinRequest;
  import com.vaadin.server.VaadinServlet;
  import com.vaadin.ui.UI;
  ${importStrings}
  
  /**
   * This UI is the application entry point. A UI may either represent a browser window 
   * (or tab) or some part of an HTML page where a Vaadin application is embedded.
   * <p>
   * The UI is initialized using {@link #init(VaadinRequest)}. This method is intended to be 
   * overridden to add component to the user interface and initialize non-component functionality.
   */
  @Theme("mytheme")
  public class ${pascalCaseName} extends UI {
      ${internalClasses}
      @Override
      protected void init(VaadinRequest vaadinRequest) {
          VerticalLayout mainLayout = new VerticalLayout();
          ${result}
          setContent(mainLayout);
      }
  
      @WebServlet(urlPatterns = "/*", name = "${pascalCaseName}Servlet", asyncSupported = true)
      @VaadinServletConfiguration(ui = ${pascalCaseName}.class, productionMode = false)
      public static class ${pascalCaseName}Servlet extends VaadinServlet {
      }
  }`;
};

const unideSplitPanel = `package sketch.app;
import com.vaadin.ui.SplitPanel;
import com.vaadin.ui.Component;

public class UnideSplitPanel extends SplitPanel {

  private boolean firstAdded = false;
  public void add(Component component) {
    if (!firstAdded) {
      addToPrimary(component);
      firstAdded = true;
    } else {
      addToSecondary(component);
    }
  }
}
`;

const pomXML = `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>

	<groupId>sketch.app</groupId>
	<artifactId>myapp</artifactId>
	<packaging>war</packaging>
	<version>1.0-SNAPSHOT</version>
	<name>something</name>

	<prerequisites>
		<maven>3</maven>
	</prerequisites>

	<properties>
		<vaadin.version>8.8.1</vaadin.version>
		<vaadin.plugin.version>8.8.1</vaadin.plugin.version>
		<jetty.plugin.version>9.3.9.v20160517</jetty.plugin.version>
		<project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
		<maven.compiler.source>1.8</maven.compiler.source>
		<maven.compiler.target>1.8</maven.compiler.target>
		<!-- If there are no local customizations, this can also be "fetch" or "cdn" -->
		<vaadin.widgetset.mode>local</vaadin.widgetset.mode>
	</properties>

	<repositories>
		<repository>
			<id>vaadin-addons</id>
			<url>http://maven.vaadin.com/vaadin-addons</url>
		</repository>
	</repositories>

	<dependencyManagement>
		<dependencies>
			<dependency>
				<groupId>com.vaadin</groupId>
				<artifactId>vaadin-bom</artifactId>
				<version>\${vaadin.version}</version>
				<type>pom</type>
				<scope>import</scope>
			</dependency>
		</dependencies>
	</dependencyManagement>

	<dependencies>
		<dependency>
			<groupId>javax.servlet</groupId>
			<artifactId>javax.servlet-api</artifactId>
			<version>3.0.1</version>
			<scope>provided</scope>
		</dependency>
		<dependency>
			<groupId>com.vaadin</groupId>
			<artifactId>vaadin-server</artifactId>
		</dependency>
		<dependency>
			<groupId>com.vaadin</groupId>
			<artifactId>vaadin-push</artifactId>
		</dependency>
		<dependency>
			<groupId>com.vaadin</groupId>
			<artifactId>vaadin-client-compiled</artifactId>
		</dependency>
		<dependency>
			<groupId>com.vaadin</groupId>
			<artifactId>vaadin-themes</artifactId>
		</dependency>
	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-war-plugin</artifactId>
				<version>3.2.0</version>
				<configuration>
					<failOnMissingWebXml>false</failOnMissingWebXml>
					<!-- Exclude an unnecessary file generated by the GWT compiler. -->
					<packagingExcludes>WEB-INF/classes/VAADIN/widgetsets/WEB-INF/**</packagingExcludes>
				</configuration>
			</plugin>
			<plugin>
				<groupId>com.vaadin</groupId>
				<artifactId>vaadin-maven-plugin</artifactId>
				<version>\${vaadin.plugin.version}</version>
				<executions>
					<execution>
						<goals>
							<goal>update-theme</goal>
							<goal>update-widgetset</goal>
							<goal>compile</goal>
							<!-- Comment out compile-theme goal to use on-the-fly theme compilation -->
							<goal>compile-theme</goal>
						</goals>
					</execution>
				</executions>
			</plugin>
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-clean-plugin</artifactId>
				<version>3.0.0</version>
				<!-- Clean up also any pre-compiled themes -->
				<configuration>
					<filesets>
						<fileset>
							<directory>src/main/webapp/VAADIN/themes</directory>
							<includes>
								<include>**/styles.css</include>
								<include>**/styles.scss.cache</include>
							</includes>
						</fileset>
					</filesets>
				</configuration>
			</plugin>

			<!-- The Jetty plugin allows us to easily test the development build by
				running jetty:run on the command line. -->
			<plugin>
				<groupId>org.eclipse.jetty</groupId>
				<artifactId>jetty-maven-plugin</artifactId>
				<version>\${jetty.plugin.version}</version>
				<configuration>
					<scanIntervalSeconds>2</scanIntervalSeconds>
				</configuration>
			</plugin>
		</plugins>
	</build>

	<profiles>
		<profile>
			<!-- Vaadin pre-release repositories -->
			<id>vaadin-prerelease</id>
			<activation>
				<activeByDefault>false</activeByDefault>
			</activation>

			<repositories>
				<repository>
					<id>vaadin-prereleases</id>
					<url>http://maven.vaadin.com/vaadin-prereleases</url>
				</repository>
				<repository>
					<id>vaadin-snapshots</id>
					<url>https://oss.sonatype.org/content/repositories/vaadin-snapshots/</url>
					<releases>
						<enabled>false</enabled>
					</releases>
					<snapshots>
						<enabled>true</enabled>
					</snapshots>
				</repository>
			</repositories>
			<pluginRepositories>
				<pluginRepository>
					<id>vaadin-prereleases</id>
					<url>http://maven.vaadin.com/vaadin-prereleases</url>
				</pluginRepository>
				<pluginRepository>
					<id>vaadin-snapshots</id>
					<url>https://oss.sonatype.org/content/repositories/vaadin-snapshots/</url>
					<releases>
						<enabled>false</enabled>
					</releases>
					<snapshots>
						<enabled>true</enabled>
					</snapshots>
				</pluginRepository>
			</pluginRepositories>
		</profile>
	</profiles>

    </project>`;

const stylesScss = `@import "mytheme.scss";
@import "addons.scss";

// This file prefixes all rules with the theme name to avoid causing conflicts with other themes.
// The actual styles should be defined in mytheme.scss

.mytheme {
  @include addons;
  @include mytheme;

}`;

const mythemeScss = `// If you edit this file you need to compile the theme. See README.md for details.

// Global variable overrides. Must be declared before importing Valo.

// Defines the plaintext font size, weight and family. Font size affects general component sizing.
//$v-font-size: 16px;
//$v-font-weight: 300;
//$v-font-family: "Open Sans", sans-serif;

// Defines the border used by all components.
//$v-border: 1px solid (v-shade 0.7);
//$v-border-radius: 4px;

// Affects the color of some component elements, e.g Button, Panel title, etc
//$v-background-color: hsl(210, 0%, 98%);
// Affects the color of content areas, e.g  Panel and Window content, TextField input etc
//$v-app-background-color: $v-background-color;

// Affects the visual appearance of all components
//$v-gradient: v-linear 8%;
//$v-bevel-depth: 30%;
//$v-shadow-opacity: 5%;

// Defines colors for indicating status (focus, success, failure)
//$v-focus-color: valo-focus-color(); // Calculates a suitable color automatically
//$v-friendly-color: #2c9720;
//$v-error-indicator-color: #ed473b;

// For more information, see: https://vaadin.com/book/-/page/themes.valo.html
// Example variants can be copy/pasted from https://vaadin.com/docs/v8/framework/articles/ValoExamples.html

@import "../valo/valo.scss";

@mixin mytheme {
  @include valo;

  // Insert your own theme rules here
}`;

const addonsScss = `/* This file is automatically managed and will be overwritten from time to time. */
/* Do not manually edit this file. */

/* Import and include this mixin into your project theme to include the addon themes */
@mixin addons {
}
`;
