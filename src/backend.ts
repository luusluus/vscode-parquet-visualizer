import { Schema, Field, Type } from "apache-arrow";

import { convertBigIntToString, convertObjectsToJSONStrings } from './util';


export abstract class Backend {
    public filePath: string;
    protected arrowSchema: Schema;
    protected metadata: any;

    public constructor(filePath: string) {
        this.filePath = filePath;
    }

    static createAsync(filePath: string): Promise<any> {
        throw new Error("Method not implemented");
    };

    abstract initialize(): Promise<void>;

    private parseSchema(field: Field) {
        if (field.typeId === Type.List) {
          let result: any = [];
          
          if (field.type.children.length > 0) {
            result =  [this.parseSchema(field.type.children[0])]
            return result;
          }
          return result;
        } 
        if (field.typeId === Type.Struct) {
          const result: any = {};
          for (const child of field.type.children) {
            result[child.name] = this.parseSchema(child);
          }
          return result;
        }
    
        let type = field.type.toString();
        if (type.includes('Utf8')) {
          type = type.replace(/Utf8/g, 'String');
        } else if (type.includes('LargeUtf8')) {
          type = type.replace(/LargeUtf8/g, 'LargeString');
        }
    
        return type;
      }
    
    // TODO: define a type (interface) for the return type.
    public getSchema(): any { 
        const parsedSchema = this.arrowSchema.fields.map((f, index) => {
            let parsedType = this.parseSchema(f);
        
            if (typeof parsedType === 'object'){
                parsedType = JSON.stringify(parsedType);
            }
        
            if(f.metadata.size > 0) {
                console.log(f.metadata);
            }
            return {
                'index': index + 1,
                'name': f.name,
                'type': parsedType,
                'nullable': f.nullable,
                'metadata': JSON.stringify(f.metadata)
            };
        });

        return parsedSchema;
    };

    abstract getSchemaImpl(): Promise<any>;

    public getMetaData(): any {
        return [
            {
                key: 'file_name',
                value: this.metadata[0]["file_name"]
            },
            {
                key: 'created_by',
                value: this.metadata[0]["created_by"]
            },
            {
                key: 'num_rows',
                value: Number(this.metadata[0]["num_rows"])
            },
            {
                key: 'num_row_groups',
                value: Number(this.metadata[0]["num_row_groups"])
            },
            {
                key: 'format_version',
                value: Number(this.metadata[0]["format_version"])
            },
            {
                key: 'encryption_algorithm',
                value: Number(this.metadata[0]["encryption_algorithm"])
            },
            {
                key: 'footer_signing_key_metadata',
                value: Number(this.metadata[0]["footer_signing_key_metadata"])
            },
        ]
    };

    abstract getMetaDataImpl(): Promise<any>;

    abstract getRowCount(): number;

    public async query(query: any): Promise<any[]> {
        const startTime = performance.now();

        const queryResult = await this.queryImpl(query);
        const result = queryResult.map(v => {
            return convertObjectsToJSONStrings(convertBigIntToString(v));
        });

        const endTime = performance.now();
        const time = endTime - startTime;
        console.log(`Query resolve time: ${time} msec.`);

        return result;
    };

    protected abstract queryImpl(query: any): Promise<any[]>;

    abstract dispose(): any;

}