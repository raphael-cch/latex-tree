'use babel';

import {latexLogo} from './latex-logo'

export default class LatexTreeView {

    constructor (serializedState = {}) {

        // Create root element
        this.rootElement = document.createElement('div');
        this.rootElement.classList.add('latex-tree-view');

        // TODO: currently we do not to anything with serializedState
        // See if needed to put more information in  serializedState
        // and use it to reconstruct the tree view
        this.selectedNowInd = null;
        this.textEditorNow = null;
        this.docTree = null;

        this.focusEditorAfterClick = atom.config.get('latex-tree.focusEditorAfterClick');
    }

    getTitle() {
        // Used by Atom for tab text
        return 'Document Tree';
    }

    getURI() {
        // Used by Atom to identify the view when toggling.
        return 'atom://latex-tree-view';
    }

    getDefaultLocation() {
        // This location will be used if the user hasn't overridden it by
        // dragging the item elsewhere. Valid values are "left", "right",
        // "bottom", and "center" (the default).
        return 'right';
    }

    getAllowedLocations() {
        // The locations into which the item can be moved.
        return ['left', 'right'];
    }

    getPreferredWidth() {
        return 300;
    }

    // Clear everything except the rootElement
    clear() {
        while (this.rootElement.hasChildNodes()) {
            this.rootElement.removeChild(this.rootElement.firstChild);
        }
    }

    // Returns an object that can be retrieved when package is activated
    serialize () {
        return {
            deserializer: 'latex-tree/LatexTreeView'
            //selectedNowInd: this.selectedNowInd,
            //textEditorNowID: this.textEditorNow.id,
            //docTree: this.docTree
        };
    }


    // Tear down any state and detach
    destroy() {
        this.clear();
        this.rootElement.remove();
    }

    getElement() {
        return this.rootElement;
    }

    // When current text editor is not LaTeX
    notAvailable() {

        this.clear();

        const naElement = document.createElement('div');
        naElement.id = "na-element";
        this.rootElement.appendChild(naElement);

        const latexLogoEl = latexLogo();
        naElement.appendChild(latexLogoEl);

        const naMessage = document.createElement('div');
        naMessage.classList.add('one-line-text');
        naMessage.textContent = "Sorry, I only understand LaTeX :(";
        naElement.appendChild(naMessage);
    }

    // Update tree view using docTree
    updateTree (docTree, editor) {

        this.clear();
        this.docTree = docTree;

        // If text editor has changed, remove selectedNowInd information
        if (editor != this.textEditorNow) {
            this.textEditorNow = editor;
            this.selectedNowInd = null;
        }

        // Create root element for tree
        const treeRoot = document.createElement('ol');
        treeRoot.id = 'tree-root';
        treeRoot.classList.add('list-tree');
        treeRoot.classList.add('has-collapsable-children');
        this.rootElement.appendChild(treeRoot);

        // Storing all latest parents of each level
        let lastParentOLNode = new Array(8);
        lastParentOLNode[0] = treeRoot;
        lastParentOLNode.fill(null, 1, 7);

        // Processing each node in docTree to turn to html element
        let haveChildren;
        for (let i = 0; i < docTree.length; i++) {

            // Determine if there is a children
            if (i === docTree.length-1)
                haveChildren = false; // Last node
            else if (docTree[i+1].level <= docTree[i].level)
                haveChildren = false;
            else
                haveChildren = true;

            // Create the html element
            let nodeElement = document.createElement('li');
            let nameTag = document.createElement('div');
            nameTag.textContent = docTree[i].text;
            nodeElement.appendChild(nameTag);
            docTree[i].htmlElement = nodeElement;

            // Append html element to correct parent
            for (var parentNodeLvl = docTree[i].level-1; parentNodeLvl >= 0; parentNodeLvl--) {
                if (lastParentOLNode[parentNodeLvl] != null) {
                    lastParentOLNode[parentNodeLvl].appendChild(nodeElement);
                    break;
                }
            }

            if (haveChildren) {
                docTree[i].listItemElement = nameTag;
                nodeElement.classList.add('list-nested-item');

                // Create additional elements for children of the element
                let childList = document.createElement('ol');
                childList.classList.add('list-tree');
                nodeElement.appendChild(childList);

                // Updating array of parents; removing parents with higher
                // levels than the current node
                lastParentOLNode[docTree[i].level] = childList;
                for (var j = docTree[i].level+1; j < lastParentOLNode.length; j++) {
                    lastParentOLNode[j] = null;
                }
            }
            else {
                docTree[i].listItemElement = nodeElement;
            }

            // Setting correct style, id and event listeners for the listItem element
            docTree[i].listItemElement.classList.add('list-item');
            docTree[i].listItemElement.id = 'list-item-' + i;
            docTree[i].listItemElement.addEventListener("mousedown", (e) => {
                this.clicked(e);
            });
            docTree[i].listItemElement.addEventListener("click", (e) => {
                this.focusTextEditor(e);
            });

        }

        // Highlight the previously remembered item
        // Only when previously rememberd item still exists
        if (this.selectedNowInd != null && this.selectedNowInd < this.docTree.length) {
            docTree[this.selectedNowInd].listItemElement.classList.add('selected-new');
        }

        // Otherwise highlight currently selected item
        this.updateHighlight(editor.getCursorBufferPosition());
    }

    // Called whenever there is a mousedown on an element
    clicked(e) {

        // Checks it is from the primary button
        if (e.button === 0) {
            this.highlight(parseInt(e.currentTarget.id.substring(10)));
            this.textEditorNow.setCursorBufferPosition(this.docTree[this.selectedNowInd].startPt);
        }
    }

    // Called whenever a click is finished (ie mousedown + mouseup)
    // Just focuses on the text editor so user can continue typing right away
    focusTextEditor(e) {
        if (this.focusEditorAfterClick && e.button === 0) {
            atom.workspace.paneForItem(this.textEditorNow).activate();
        }
    }

    // Update highlight when the cursor position changed
    updateHighlight(cursorPosition) {

        // If called before first docTree generated
        if (this.docTree === null)
            return;

        // Check if it is in front of all nodes
        if (this.docTree[0].startPt.isGreaterThan(cursorPosition)) {
            this.scrollTo(0);
            return;
        }
        for (var i = this.docTree.length-1; i >= 0; i--) {
            if (this.docTree[i].startPt.isLessThanOrEqual(cursorPosition)) {
                this.highlight(i);
                this.scrollTo(i);
                return;
            }
        }
    }

    // Remove original highlight and highlight the element docTree[newInd]
    highlight(newInd) {

        // Remove previously selected item and update selectedNowInd
        if (this.selectedNowInd != null && this.selectedNowInd < this.docTree.length) {
            this.docTree[this.selectedNowInd].listItemElement.classList.remove('selected-new');
        }
        this.selectedNowInd = newInd;

        // Add relevant style to the current selected item
        this.docTree[this.selectedNowInd].listItemElement.classList.add('selected-new');
    }

    // Scroll to docTree[ind]
    scrollTo (ind) {
        this.docTree[ind].htmlElement.scrollIntoViewIfNeeded();
    }
}
