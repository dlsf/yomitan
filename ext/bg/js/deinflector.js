/*
 * Copyright (C) 2016  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


class Deinflection {
    constructor(term, rules=[], reason='') {
        this.children = [];
        this.term = term;
        this.rules = rules;
        this.reason = reason;
        this.definitions = [];
    }

    deinflect(definer, reasons, entry=false) {
        const validate = () => {
            return definer(this.term).then(definitions => {
                if (entry) {
                    this.definitions = definitions;
                } else {
                    for (const rule of this.rules) {
                        for (const definition of definitions) {
                            if (definition.rules.includes(rule)) {
                                this.definitions.push(definition);
                            }
                        }
                    }
                }

                return this.definitions.length > 0;
            });
        };

        const promises = [
            validate().then(valid => {
                const child = new Deinflection(this.term, this.rules);
                this.children.push(child);
            })
        ];

        for (const reason in reasons) {
            for (const variant of reasons[reason]) {
                let allowed = entry;
                if (!allowed) {
                    for (const rule of this.rules) {
                        if (variant.rulesIn.includes(rule)) {
                            allowed = true;
                            break;
                        }
                    }
                }

                if (!allowed || !this.term.endsWith(variant.kanaIn)) {
                    continue;
                }

                const term = this.term.slice(0, -variant.kanaIn.length) + variant.kanaOut;
                if (term.length === 0) {
                    continue;
                }

                const child = new Deinflection(term, variant.rulesOut, reason);
                promises.push(
                    child.deinflect(definer, reasons).then(valid => {
                        if (valid) {
                            this.children.push(child);
                        }
                    }
                ));
            }
        }

        return Promise.all(promises).then(() => {
            return this.children.length > 0;
        });
    }

    gather() {
        if (this.children.length === 0) {
            return [{
                root: this.term,
                rules: this.rules,
                definitions: this.definitions,
                reasons: []
            }];
        }

        const paths = [];
        for (const child of this.children) {
            for (const path of child.gather()) {
                path.definitions = path.definitions.concat(this.definitions);
                if (this.reason.length > 0) {
                    path.reasons.push(this.reason);
                }

                path.source = this.term;
                paths.push(path);
            }
        }

        return paths;
    }
}


class Deinflector {
    constructor() {
        this.reasons = {};
    }

    setReasons(reasons) {
        this.reasons = reasons;
    }

    deinflect(term, definer) {
        const node = new Deinflection(term);
        return node.deinflect(definer, this.reasons, true).then(success => success ? node.gather() : []);
    }
}
