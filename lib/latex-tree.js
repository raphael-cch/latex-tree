'use babel';

import { Point, Range } from 'atom'
import LatexTreeView from './latex-tree-view';
import { CompositeDisposable, Disposable } from 'atom';
import ParseObject from './ParseObject';

var timeout = null; // For reducing frequency of updateTreeView

export default {

    // Global subscriptions (eg tab switches)
    globalSubscriptions: null,
    // Current editor subscriptions (cleared when current editor changes,
    // eg when user changes / closes tab)
    currentSubscriptions: null,
    // Subscription used for deserializing
    deserializeSubscriptions: null,
    // Tree view object
    treeView: null,
    // Remembers last latex editor to improve performance
    lastLatexPane: null,

    activate () {

        // If activate is called because of deserialization, dispose
        // the relevant subscriptions (since deserialize would only
        // be called once)
        if (this.deserializeSubscriptions != null)
            this.deserializeSubscriptions.dispose();

        this.treeView = new LatexTreeView();

        // Events subscribed to in atom's system can be easily cleaned up with
        // a CompositeDisposable
        this.globalSubscriptions = new CompositeDisposable();
        this.currentSubscriptions = new CompositeDisposable();

        // Register command that toggles this view
        this.globalSubscriptions.add(
            atom.commands.add(
                'atom-workspace', { 'latex-tree:toggle-tree-view': () => {
                    atom.workspace.toggle('atom://latex-tree-view');
                }}
            )
        );

        // When tab stops changing, update current editor settings
        this.globalSubscriptions.add(
            atom.workspace.onDidStopChangingActivePaneItem(paneItem => {
                this.updateCurrentSettings(paneItem);
            })
        );

        // Open panel for toggle commands
        this.globalSubscriptions.add(atom.workspace.addOpener(uri => {
            if (uri === 'atom://latex-tree-view') {
                return this.treeView;
            }
        }));

        // Destroy tree views when the package is deactivated
        new Disposable(() => {
            atom.workspace.getPaneItems().forEach(item => {
                if (item instanceof LatexTreeView)
                    item.destroy();
            });
        })

        // Update current editor settings for the first time
        this.updateCurrentSettings(atom.workspace.getActiveTextEditor());
    },

    // Called whenever the current tab stops changing
    updateCurrentSettings(paneItem) {

        // Check it is a text editor
        if (!atom.workspace.isTextEditor(paneItem))
            return;

        // Checks if language is LaTeX
        if (paneItem.getRootScopeDescriptor().getScopesArray()[0]
            === 'text.tex.latex') {

            // Remove previous subscriptions
            this.currentSubscriptions.dispose();

            /*
            // Subscribe to save events
            this.currentSubscriptions.add(
                paneItem.onDidSave( () => {
                    this.updateTreeView(paneItem);
                })
            );
            */

            // Experimental - see performance
            // Subscribe to stop changing events
            this.currentSubscriptions.add(
                paneItem.onDidStopChanging( () => {
                    this.updateTreeView(paneItem);
                })
            )

            // Subscribe to cursor change events
            this.currentSubscriptions.add(
                paneItem.onDidChangeCursorPosition( (e) => {
                    this.treeView.updateHighlight(e.newBufferPosition);
                })
            )

            // Update tree view for the first time
            // only if the pane item has changed
            // ie it is not the same as the lastLatexPane
            if (paneItem != this.lastLatexPane) {
                this.lastLatexPane = paneItem;
                this.updateTreeView(paneItem);
            }
        }
        else {
            // Language is not LaTeX
            this.treeView.notAvailable();
            this.currentSubscriptions.dispose();
        }
    },

    // Called whenever tab stops changing or when document is saved
    updateTreeView(editor) {
        if (timeout != null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            let docTree = this.getDocTree(editor);
            this.treeView.updateTree(docTree, editor);
        }, 500);
    },

    deactivate() {
        this.globalSubscriptions.dispose();
        this.currentSubscriptions.dispose();
        this.deserializeSubscriptions.dispose();
        this.treeView.destroy();
    },

    // Function will be called when Atom starts if there is
    // deserialization to do, since it is registered in package.json
    // Do not do anything right away because everything (including
    // the atom environment) has not been loaded yet, instead
    // wait until everything finished loading then toggle (open)
    // the tree view
    deserializeTreeView (serialized) {
        this.deserializeSubscriptions = atom.packages.onDidActivateInitialPackages(() => {
            atom.commands.dispatch(document.querySelector("atom-workspace"), "latex-tree:toggle-tree-view");
        })
    },

    // Returns document tree of current editor
    getDocTree(editor) {
        let regEx = new RegExp(/\\(part|chapter|(?:sub){0,2}section|(?:sub)?paragraph)(?:\s*(?:%.*\s*)*\*?\s*(?:%.*\s*)*{|\s*(?:%.*\s*)*\[|\s*%)/, 'gm');
        let docTree = [];

        // Scan editor for regex
        editor.getBuffer().scan(regEx, result => {
            let parseObj = new ParseObject(result);

            // It may be a false match (eg. commented / incorrect syntax)
            if (parseObj.parse() === null)
                return;
            docTree.push(parseObj.createDocNode());
        });

        return docTree;
    }

};
