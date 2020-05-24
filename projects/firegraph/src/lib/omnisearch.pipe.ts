import { Pipe, PipeTransform } from '@angular/core';
import { JSONPath } from '@astronautlabs/jsonpath';

@Pipe({
    name: 'omnisearch'
})
export class OmnisearchPipe implements PipeTransform {

    private regexSearch(input : any[], query : string): any[] {
        let regex : RegExp;
        let parsable = query.substr(1);
        let result = /\/[^\/]*/.exec(parsable);
        let options = 'i';

        if (result && result.length > 0) {
            options = result[0].substr(1);
            parsable = parsable.substr(0, result.index);
        }

        try {
            regex = new RegExp(parsable, options);
        } catch (e) {
            console.error(`Search: Failed to parse regular expression '${query}'`);
        }

        return input.filter(x => JSON.stringify(x).match(regex));
    }

    private jsonPathSearch(input : any[], query : string): any[] {
        let parts = query.split(' ', 2);
        let expr = parts[0];
        let subquery = parts[1] || '';

        subquery = subquery.toLowerCase();

        let jsonPathFailed = false;
        return input.filter(x => {
            if (jsonPathFailed)
                return false;

            let matches : any[];
            
            try {
                matches = JSONPath.query(x, expr);
            } catch (e) {
                jsonPathFailed = true;
                console.warn(`Failed to parse JSONPath '${expr}':`);
                console.warn(e);
                return false;
            }

            if (matches.length === 0)
                return false;
            
            return JSON.stringify(matches).toLowerCase().includes(subquery);
        });
    }


    private jsonSearch(input : any[], query : string): any[] {
        query = query.toLowerCase();
        let words = query.split(' ');
        let results = input.map(x => {
            let score = 0;
            let subject = JSON.stringify(x).toLowerCase();
            let wordValue = words.length;

            for (let word of words) {
                if (subject.includes(word))
                    score += wordValue;
                wordValue -= 1;
            }

            return { item: x, score };
        });

        return results
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.item)
        ;
    }

    transform(input : any[], query : string) {
        if (!query)
            return input;
        
        let results : any[];

        if (query.startsWith('/')) {
            results = this.regexSearch(input, query);
        } else if (query.startsWith('$.')) {
            results = this.jsonPathSearch(input, query);
        } else {
            results = this.jsonSearch(input, query);
        }

        if (results.length === 0)
            results.push(null);

        return results;
    }
}