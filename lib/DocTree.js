'use babel';

import ParseObject from './ParseObject';

const UPDATE_FREQ = {
    'High': 0,
    'Medium': 500,
    'Low': 2000,
    'On Save Only': -1
}

// DocTree: represents the document tree and all related actions relating to the abstract tree
export default class DocTree {
    constructor(updateFreqText) {
        this.setUpdateFreq(updateFreqText);
        this.docTree = [];
        this.timeout = null;
    }

    // Change update frequency
    setUpdateFreq(updateFreqText) {
        this.updateFreq = UPDATE_FREQ[updateFreqText];
    }

    // Update document tree of current editor
    updateDocTree(editor) {

        // Resets docTree
        this.docTree = [];

        let regEx = new RegExp(/\\(part|chapter|(?:sub){0,2}section|(?:sub)?paragraph)(?:\s*(?:%.*\s*)*\*?\s*(?:%.*\s*)*{|\s*(?:%.*\s*)*\[|\s*%)/, 'gm');

        // Scan editor for regex
        editor.getBuffer().scan(regEx, result => {
            let parseObj = new ParseObject(result);

            // It may be a false match (eg. commented / incorrect syntax)
            if (parseObj.parse() === null)
                return;
            this.docTree.push(parseObj.createDocNode());
        });
    }

    // Called whenever tab stops changing or when document is saved
    updateTreeView(editor, updateImmediately, treeView) {
        if (updateImmediately || this.updateFreq <= 0) {
            this.updateDocTree(editor);
            treeView.updateTree(this.docTree, editor);
        }
        else {
            if (this.timeout != null) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(() => {
                this.updateDocTree(editor);
                treeView.updateTree(this.docTree, editor);
            }, this.updateFreq);
        }
    }

}
