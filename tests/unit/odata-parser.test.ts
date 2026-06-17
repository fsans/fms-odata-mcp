import { describe, test, expect } from '@jest/globals';
import { ODataParser } from '../../src/odata-parser';

describe('ODataParser', () => {
  describe('parseMetadataForTables', () => {
    test('should parse valid OData metadata XML', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Key>
          <PropertyRef Name="recordId"/>
        </Key>
        <Property Name="recordId" Type="Edm.String"/>
        <Property Name="firstName" Type="Edm.String"/>
        <Property Name="lastName" Type="Edm.String"/>
      </EntityType>
      <EntityType Name="address">
        <Key>
          <PropertyRef Name="recordId"/>
        </Key>
        <Property Name="recordId" Type="Edm.String"/>
        <Property Name="street" Type="Edm.String"/>
      </EntityType>
      <EntityContainer Name="Container">
        <EntitySet Name="contact" EntityType="FMS.contact"/>
        <EntitySet Name="address" EntityType="FMS.address"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      
      expect(tables).toHaveLength(2);
      expect(tables.map((t) => t.name)).toContain('contact');
      expect(tables.map((t) => t.name)).toContain('address');
    });

    test('should return empty array for empty metadata', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityContainer Name="Container">
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      
      expect(tables).toHaveLength(0);
    });

    test('should handle metadata without EntityContainer', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      
      expect(tables).toHaveLength(0);
    });

    test('should handle invalid XML gracefully', () => {
      const metadata = 'not valid xml';

      expect(() => {
        ODataParser.parseMetadataForTables(metadata);
      }).not.toThrow();
    });

    test('should extract multiple tables correctly', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityContainer Name="Container">
        <EntitySet Name="users" EntityType="FMS.user"/>
        <EntitySet Name="orders" EntityType="FMS.order"/>
        <EntitySet Name="products" EntityType="FMS.product"/>
        <EntitySet Name="categories" EntityType="FMS.category"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      
      expect(tables).toHaveLength(4);
      expect(tables.map((t) => t.name)).toEqual(['users', 'orders', 'products', 'categories']);
    });

    test('should handle FileMaker Server metadata format', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMSODATA">
      <EntityType Name="contact">
        <Key>
          <PropertyRef Name="recordId"/>
          <PropertyRef Name="modId"/>
          <PropertyRef Name="__ID"/>
        </Key>
        <Property Name="recordId" Type="Edm.Decimal"/>
        <Property Name="modId" Type="Edm.Decimal"/>
        <Property Name="__ID" Type="Edm.String"/>
        <Property Name="FirstName" Type="Edm.String"/>
      </EntityType>
      <EntityContainer Name="FMSODATA">
        <EntitySet Name="contact" EntityType="FMSODATA.contact"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      
      expect(tables.map((t) => t.name)).toContain('contact');
    });

    test('should NOT extract comments when serverVersion is omitted', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityContainer Name="Container">
        <EntitySet Name="contact" EntityType="FMS.contact" Description="Contact table"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const tables = ODataParser.parseMetadataForTables(metadata);
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('contact');
      expect(tables[0].comment).toBeUndefined();
    });

    test('should NOT extract comments when serverVersion is below v26', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityContainer Name="Container">
        <EntitySet Name="contact" EntityType="FMS.contact" Description="Contact table"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v25 = { major: 25, minor: 0, patch: 0, raw: "25.0.0" };
      const tables = ODataParser.parseMetadataForTables(metadata, v25);
      expect(tables).toHaveLength(1);
      expect(tables[0].comment).toBeUndefined();
    });

    test('should extract comments when serverVersion is v26+', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityContainer Name="Container">
        <EntitySet Name="contact" EntityType="FMS.contact" Description="Contact table"/>
        <EntitySet Name="address" EntityType="FMS.address"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v26 = { major: 26, minor: 0, patch: 0, raw: "26.0.0" };
      const tables = ODataParser.parseMetadataForTables(metadata, v26);
      expect(tables).toHaveLength(2);
      expect(tables[0].name).toBe('contact');
      expect(tables[0].comment).toBe('Contact table');
      expect(tables[1].name).toBe('address');
      expect(tables[1].comment).toBeUndefined();
    });
  });

  describe('formatResponse', () => {
    test('should format simple response with pretty print', () => {
      const data = { id: 1, name: 'Test' };
      const formatted = ODataParser.formatResponse(data, true);
      
      expect(formatted).toContain('"id": 1');
      expect(formatted).toContain('"name": "Test"');
      expect(formatted).toContain('\n'); // Should have newlines for pretty print
    });

    test('should format response without pretty print', () => {
      const data = { id: 1, name: 'Test' };
      const formatted = ODataParser.formatResponse(data, false);
      
      expect(formatted).toBe('{"id":1,"name":"Test"}');
      expect(formatted).not.toContain('\n');
    });

    test('should handle null or undefined values', () => {
      const data = { id: 1, name: null, description: undefined };
      const formatted = ODataParser.formatResponse(data);
      
      expect(formatted).toContain('"name": null');
    });
  });

  describe('formatQueryResponse', () => {
    test('should format query response with count', () => {
      const response = {
        '@odata.context': 'https://server/odata/$metadata#table',
        '@odata.count': 100,
        value: [
          { id: 1, name: 'Test' }
        ]
      };

      const formatted = ODataParser.formatQueryResponse(response);
      
      expect(formatted).toContain('"count": 100');
      expect(formatted).toContain('"records"');
    });

    test('should format query response without count', () => {
      const response = {
        '@odata.context': 'https://server/odata/$metadata#table',
        value: [
          { id: 1, name: 'Test' },
          { id: 2, name: 'Test2' }
        ]
      };

      const formatted = ODataParser.formatQueryResponse(response);
      
      expect(formatted).toContain('"records"');
      const parsed = JSON.parse(formatted);
      expect(parsed.records).toHaveLength(2);
    });

    test('should include context when requested', () => {
      const response = {
        '@odata.context': 'https://server/odata/$metadata#table',
        value: []
      };

      const formatted = ODataParser.formatQueryResponse(response, true);
      
      expect(formatted).toContain('"context"');
      expect(formatted).toContain('https://server/odata/$metadata#table');
    });
  });

  describe('formatServiceDocument', () => {
    test('should format service document', () => {
      const serviceDoc = {
        '@odata.context': 'https://server/odata/$metadata',
        value: [
          { name: 'table1', kind: 'EntitySet', url: 'table1' },
          { name: 'table2', kind: 'EntitySet', url: 'table2' }
        ]
      };

      const formatted = ODataParser.formatServiceDocument(serviceDoc);
      
      expect(formatted).toContain('table1');
      expect(formatted).toContain('table2');
      expect(formatted).toContain('EntitySet');
    });
  });

  describe('parseMetadataForFields', () => {
    test('should parse fields from metadata', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String" Nullable="false"/>
        <Property Name="firstName" Type="Edm.String"/>
        <Property Name="lastName" Type="Edm.String"/>
        <Property Name="age" Type="Edm.Int32" Nullable="false"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const fields = ODataParser.parseMetadataForFields(metadata, 'contact');
      
      expect(fields).toHaveLength(4);
      expect(fields[0]).toEqual({
        name: 'recordId',
        type: 'Edm.String',
        nullable: false,
        maxLength: undefined
      });
    });

    test('should return empty array for non-existent table', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const fields = ODataParser.parseMetadataForFields(metadata, 'nonexistent');
      
      expect(fields).toHaveLength(0);
    });

    test('escapes regex metacharacters in table name (regression: parens, dots, plus)', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityType Name="My.Table(v2)">
    <Property Name="id" Type="Edm.String"/>
  </EntityType>
  <EntityType Name="OtherTable">
    <Property Name="other" Type="Edm.String"/>
  </EntityType>
</edmx:Edmx>`;

      const fields = ODataParser.parseMetadataForFields(metadata, 'My.Table(v2)');
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('id');
    });

    test('regex metachars do not match unrelated entities', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityType Name="OtherTable">
    <Property Name="other" Type="Edm.String"/>
  </EntityType>
</edmx:Edmx>`;

      // The pattern "O.herTable" with regex would match "OtherTable"; the
      // fix must treat it as a literal name and find nothing.
      const fields = ODataParser.parseMetadataForFields(metadata, 'O.herTable');
      expect(fields).toHaveLength(0);
    });

    test('should NOT extract comments/annotations when serverVersion is omitted', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const fields = ODataParser.parseMetadataForFields(metadata, 'contact');
      expect(fields).toHaveLength(1);
      expect(fields[0].comment).toBeUndefined();
      expect(fields[0].aiAnnotation).toBeUndefined();
    });

    test('should NOT extract comments/annotations when serverVersion is below v26', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Annotation Term="Org.OData.Core.V1.Description"><String>record ID field</String></Annotation>
        <Property Name="recordId" Type="Edm.String"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v25 = { major: 25, minor: 0, patch: 0, raw: "25.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v25);
      expect(fields).toHaveLength(1);
      expect(fields[0].comment).toBeUndefined();
      expect(fields[0].aiAnnotation).toBeUndefined();
    });

    test('should extract v26 child annotations inside Property blocks', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String">
          <Annotation Term="com.filemaker.odata.FMComment" String="record ID field" />
        </Property>
        <Property Name="firstName" Type="Edm.String">
          <Annotation Term="com.filemaker.odata.AIAnnotation" String="AI hint for name" />
        </Property>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v26 = { major: 26, minor: 0, patch: 0, raw: "26.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v26);
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('recordId');
      expect(fields[0].comment).toBe('record ID field');
      expect(fields[0].aiAnnotation).toBeUndefined();
      expect(fields[1].name).toBe('firstName');
      expect(fields[1].comment).toBeUndefined();
      expect(fields[1].aiAnnotation).toBe('AI hint for name');
    });

    test('should parse v26 block-style Property with child annotations', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String" Nullable="false">
          <Annotation Term="com.filemaker.odata.FieldID" String="FMFID:60130607233" />
          <Annotation Term="com.filemaker.odata.FMComment" String="Primary key" />
        </Property>
        <Property Name="fullName" Type="Edm.String">
          <Annotation Term="Org.OData.Core.V1.Computed" Bool="true" />
          <Annotation Term="com.filemaker.odata.Calculation" Bool="true" />
          <Annotation Term="Org.OData.Core.V1.Permissions">
            <EnumMember>Org.OData.Core.V1.Permission/Read</EnumMember>
          </Annotation>
          <Annotation Term="com.filemaker.odata.AIAnnotation" String="AI name hint" />
        </Property>
        <Property Name="email" Type="Edm.String">
          <Annotation Term="com.filemaker.odata.Index" Bool="true" />
          <Annotation Term="Org.OData.Core.V1.Permissions">
            <EnumMember>Org.OData.Core.V1.Permission/ReadWrite</EnumMember>
          </Annotation>
        </Property>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v26 = { major: 26, minor: 0, patch: 0, raw: "26.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v26);
      expect(fields).toHaveLength(3);

      // recordId
      expect(fields[0].name).toBe('recordId');
      expect(fields[0].nullable).toBe(false);
      expect(fields[0].fieldId).toBe('FMFID:60130607233');
      expect(fields[0].comment).toBe('Primary key');

      // fullName (calculation, read-only)
      expect(fields[1].name).toBe('fullName');
      expect(fields[1].computed).toBe(true);
      expect(fields[1].calculation).toBe(true);
      expect(fields[1].permissions).toBe('Read');
      expect(fields[1].aiAnnotation).toBe('AI name hint');

      // email (indexed, read/write)
      expect(fields[2].name).toBe('email');
      expect(fields[2].indexed).toBe(true);
      expect(fields[2].permissions).toBe('Read/Write');
    });

    test('should still parse self-closing Property tags on v22/v25 (backward compat)', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String" Nullable="false"/>
        <Property Name="firstName" Type="Edm.String" MaxLength="100"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v25 = { major: 25, minor: 0, patch: 0, raw: "25.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v25);
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('recordId');
      expect(fields[0].nullable).toBe(false);
      expect(fields[0].fieldId).toBeUndefined();
      expect(fields[1].name).toBe('firstName');
      expect(fields[1].maxLength).toBe(100);
      expect(fields[1].fieldId).toBeUndefined();
    });

    test('should handle mixed self-closing and block-style Property elements', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="id" Type="Edm.Int64" Nullable="false"/>
        <Property Name="name" Type="Edm.String">
          <Annotation Term="com.filemaker.odata.FieldID" String="FMFID:123" />
        </Property>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v26 = { major: 26, minor: 0, patch: 0, raw: "26.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v26);
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('id');
      expect(fields[0].fieldId).toBeUndefined();
      expect(fields[1].name).toBe('name');
      expect(fields[1].fieldId).toBe('FMFID:123');
    });

    test('should not extract annotations when serverVersion is below v26', () => {
      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
  <edmx:DataServices>
    <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="FMS">
      <EntityType Name="contact">
        <Property Name="recordId" Type="Edm.String" Nullable="false">
          <Annotation Term="com.filemaker.odata.FieldID" String="FMFID:999" />
        </Property>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

      const v25 = { major: 25, minor: 0, patch: 0, raw: "25.0.0" };
      const fields = ODataParser.parseMetadataForFields(metadata, 'contact', v25);
      expect(fields).toHaveLength(1);
      expect(fields[0].fieldId).toBeUndefined();
    });
  });

  describe('createQuerySummary', () => {
    test('should create summary with count', () => {
      const response = {
        '@odata.context': 'test',
        '@odata.count': 100,
        value: Array(10).fill({ id: 1 })
      };

      const summary = ODataParser.createQuerySummary(response);
      
      expect(summary).toContain('10 record(s)');
      expect(summary).toContain('100 total');
    });

    test('should create summary without count', () => {
      const response = {
        '@odata.context': 'test',
        value: Array(5).fill({ id: 1 })
      };

      const summary = ODataParser.createQuerySummary(response);

      expect(summary).toContain('5 record(s)');
      expect(summary).not.toContain('total');
    });

    test('should treat a bare entity response as 1 record (no value wrapper)', () => {
      // Single-entity OData responses have no `value` array.
      const response: any = {
        '@odata.context': 'test#$entity',
        id: 42,
        name: 'Lone Record',
      };

      const summary = ODataParser.createQuerySummary(response);

      expect(summary).toContain('1 record(s)');
    });

    test('should return 0 records (not crash) when response is null/undefined', () => {
      expect(() =>
        ODataParser.createQuerySummary(null as any)
      ).not.toThrow();
      expect(ODataParser.createQuerySummary(null as any)).toContain('0 record(s)');
      expect(ODataParser.createQuerySummary(undefined as any)).toContain('0 record(s)');
    });
  });

  describe('formatQueryResponse — defensive shape handling', () => {
    test('wraps a bare entity response as a one-record list', () => {
      const response: any = { id: 7938, Nummer: 'BX01692' };
      const formatted = JSON.parse(ODataParser.formatQueryResponse(response));
      expect(formatted.records).toEqual([{ id: 7938, Nummer: 'BX01692' }]);
    });

    test('handles missing value gracefully (empty records list)', () => {
      const formatted = JSON.parse(ODataParser.formatQueryResponse(null as any));
      expect(formatted.records).toEqual([]);
    });

    test('preserves @odata.count when present', () => {
      const response: any = { '@odata.count': 90, value: [{ id: 1 }] };
      const formatted = JSON.parse(ODataParser.formatQueryResponse(response));
      expect(formatted.count).toBe(90);
      expect(formatted.records).toEqual([{ id: 1 }]);
    });
  });

  describe('extractFieldNames', () => {
    test('should extract field names excluding @odata properties', () => {
      const record = {
        '@odata.id': 'test',
        '@odata.etag': 'W/"123"',
        id: 1,
        name: 'Test',
        email: 'test@test.com'
      };

      const fields = ODataParser.extractFieldNames(record);
      
      expect(fields).toHaveLength(3);
      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).toContain('email');
      expect(fields).not.toContain('@odata.id');
    });
  });

  describe('formatBatchResults', () => {
    test('should format batch results', () => {
      const results = [
        { success: true, status: 200, data: { id: 1 } },
        { success: true, status: 201, data: { id: 2 } },
        { success: false, status: 400, error: 'Bad request' }
      ];

      const formatted = ODataParser.formatBatchResults(results);
      
      expect(formatted).toContain('"total": 3');
      expect(formatted).toContain('"successful": 2');
      expect(formatted).toContain('"failed": 1');
    });
  });

  describe('buildParameterizedFilter', () => {
    test('resolved mode: substitutes a string alias with auto-quoting', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Title eq @title",
        { "@title": "Wizard of Oz" }
      );
      expect(result).toBe("Title eq 'Wizard of Oz'");
    });

    test('resolved mode: passes through already-quoted string value', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Title eq @title",
        { "@title": "'Wizard of Oz'" }
      );
      expect(result).toBe("Title eq 'Wizard of Oz'");
    });

    test('resolved mode: substitutes a numeric alias without quotes', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Age gt @minAge",
        { "@minAge": 18 }
      );
      expect(result).toBe("Age gt 18");
    });

    test('resolved mode: substitutes a boolean alias', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Active eq @flag",
        { "@flag": true }
      );
      expect(result).toBe("Active eq true");
    });

    test('resolved mode: substitutes null alias', () => {
      const result = ODataParser.buildParameterizedFilter(
        "DeletedAt eq @val",
        { "@val": null }
      );
      expect(result).toBe("DeletedAt eq null");
    });

    test('resolved mode: substitutes multiple aliases', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Title eq @title and Status eq @status",
        { "@title": "Oz", "@status": "Active" }
      );
      expect(result).toBe("Title eq 'Oz' and Status eq 'Active'");
    });

    test('resolved mode: escapes internal single quotes in string values', () => {
      const result = ODataParser.buildParameterizedFilter(
        "LastName eq @name",
        { "@name": "O'Brien" }
      );
      expect(result).toBe("LastName eq 'O''Brien'");
    });

    test('resolved mode: longer alias is not partially replaced by shorter alias', () => {
      // @titlePrefix must not be broken by @title substitution
      const result = ODataParser.buildParameterizedFilter(
        "@titlePrefix eq @title",
        { "@title": "Oz", "@titlePrefix": "The" }
      );
      expect(result).toBe("'The' eq 'Oz'");
    });

    test('raw mode: returns filter template, params string, and queryString', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Title eq @title",
        { "@title": "'Wizard of Oz'" },
        "raw"
      ) as { filter: string; params: string; queryString: string };
      expect(result.filter).toBe("Title eq @title");
      expect(result.params).toBe("@title='Wizard of Oz'");
      expect(result.queryString).toBe("$filter=Title eq @title&@title='Wizard of Oz'");
    });

    test('raw mode: multiple params joined with &', () => {
      const result = ODataParser.buildParameterizedFilter(
        "Title eq @title and Age gt @age",
        { "@title": "Oz", "@age": 18 },
        "raw"
      ) as { filter: string; params: string; queryString: string };
      expect(result.queryString).toContain("@title='Oz'");
      expect(result.queryString).toContain("@age=18");
    });
  });

  describe('buildCastExpression', () => {
    test('should append /Edm.<type> when called with bare type name', () => {
      expect(ODataParser.buildCastExpression('StartDate', 'Int64')).toBe('StartDate/Edm.Int64');
    });

    test('should not double-prefix when type already starts with Edm.', () => {
      expect(ODataParser.buildCastExpression('Amount', 'Edm.Decimal')).toBe('Amount/Edm.Decimal');
    });

    test('should work for String type', () => {
      expect(ODataParser.buildCastExpression('Amount', 'String')).toBe('Amount/Edm.String');
    });

    test('should work for DateTimeOffset type', () => {
      expect(ODataParser.buildCastExpression('CreatedAt', 'DateTimeOffset')).toBe('CreatedAt/Edm.DateTimeOffset');
    });

    test('should produce a usable $filter fragment when compared', () => {
      const castPath = ODataParser.buildCastExpression('Amount', 'String');
      const filterExpr = `${castPath} eq '100'`;
      expect(filterExpr).toBe("Amount/Edm.String eq '100'");
    });

    test('should produce joinable $select fragments', () => {
      const a = ODataParser.buildCastExpression('StartDate', 'Int64');
      const b = ODataParser.buildCastExpression('Name', 'String');
      expect([a, b].join(',')).toBe('StartDate/Edm.Int64,Name/Edm.String');
    });
  });

  describe('buildApplyExpression', () => {
    test('should produce aggregate($count as Total) when called with no args', () => {
      expect(ODataParser.buildApplyExpression()).toBe('aggregate($count as Total)');
    });

    test('should produce $count alias form for method "count"', () => {
      const expr = ODataParser.buildApplyExpression({ method: 'count', alias: 'RecordCount' });
      expect(expr).toBe('aggregate($count as RecordCount)');
    });

    test('should produce "field with method as alias" form for sum', () => {
      const expr = ODataParser.buildApplyExpression({ method: 'sum', alias: 'TotalAmount', field: 'Amount' });
      expect(expr).toBe('aggregate(Amount with sum as TotalAmount)');
    });

    test('should produce "field with method as alias" form for average', () => {
      const expr = ODataParser.buildApplyExpression({ method: 'average', alias: 'AvgAge', field: 'Age' });
      expect(expr).toBe('aggregate(Age with average as AvgAge)');
    });

    test('should fall back to alias as field name when field is omitted for non-count', () => {
      const expr = ODataParser.buildApplyExpression({ method: 'max', alias: 'Revenue' });
      expect(expr).toBe('aggregate(Revenue with max as Revenue)');
    });

    test('should wrap in groupby when groupBy fields are provided', () => {
      const expr = ODataParser.buildApplyExpression(
        { method: 'sum', alias: 'TotalSales', field: 'Sales' },
        ['Region']
      );
      expect(expr).toBe('groupby((Region),aggregate(Sales with sum as TotalSales))');
    });

    test('should handle multiple groupBy fields', () => {
      const expr = ODataParser.buildApplyExpression(
        { method: 'sum', alias: 'TotalSales', field: 'Sales' },
        ['Region', 'Status']
      );
      expect(expr).toBe('groupby((Region,Status),aggregate(Sales with sum as TotalSales))');
    });

    test('should prepend filter transformation when filter is provided', () => {
      const expr = ODataParser.buildApplyExpression(
        { method: 'sum', alias: 'Total', field: 'Revenue' },
        ['Region'],
        "Status eq 'Active'"
      );
      expect(expr).toBe("filter(Status eq 'Active')/groupby((Region),aggregate(Revenue with sum as Total))");
    });

    test('should prepend filter even without groupBy', () => {
      const expr = ODataParser.buildApplyExpression(
        { method: 'count', alias: 'Total' },
        undefined,
        "Status eq 'Active'"
      );
      expect(expr).toBe("filter(Status eq 'Active')/aggregate($count as Total)");
    });
  });

  describe('parseMetadataForScripts', () => {
    test('should return empty array when no Action elements present', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityContainer/>
</edmx:Edmx>`;
      const scripts = ODataParser.parseMetadataForScripts(metadata);
      expect(scripts).toHaveLength(0);
    });

    test('should return empty array when no Script Actions present', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityContainer>
    <Action Name="CustomAction">
      <Parameter Name="input" Type="Edm.String"/>
    </Action>
  </EntityContainer>
</edmx:Edmx>`;
      const scripts = ODataParser.parseMetadataForScripts(metadata);
      expect(scripts).toHaveLength(0);
    });

    test('should parse script name, parameter type, return type, and FMSID', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityContainer>
    <Action Name="Script.HelloScript">
      <Parameter Name="scriptParameterValue" Type="Edm.String" />
      <ReturnType Type="Edm.String" />
      <Annotation Term="com.filemaker.odata.ScriptID" String="FMSID:72" />
    </Action>
    <Action Name="Script.ProcessData">
      <Parameter Name="scriptParameterValue" Type="Edm.Int32"/>
      <ReturnType Type="Edm.Boolean" />
      <Annotation Term="com.filemaker.odata.ScriptID" String="FMSID:15" />
    </Action>
  </EntityContainer>
</edmx:Edmx>`;
      const scripts = ODataParser.parseMetadataForScripts(metadata);
      expect(scripts).toHaveLength(2);
      expect(scripts[0]).toEqual({
        name: 'HelloScript',
        parameterType: 'Edm.String',
        returnType: 'Edm.String',
        scriptId: 72,
      });
      expect(scripts[1]).toEqual({
        name: 'ProcessData',
        parameterType: 'Edm.Int32',
        returnType: 'Edm.Boolean',
        scriptId: 15,
      });
    });

    test('should parse script with missing optional fields', () => {
      const metadata = `<?xml version="1.0"?>
<edmx:Edmx>
  <EntityContainer>
    <Action Name="Script.SimpleScript">
    </Action>
  </EntityContainer>
</edmx:Edmx>`;
      const scripts = ODataParser.parseMetadataForScripts(metadata);
      expect(scripts).toHaveLength(1);
      expect(scripts[0]).toEqual({ name: 'SimpleScript' });
    });
  });
});
