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
      expect(tables).toContain('contact');
      expect(tables).toContain('address');
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
      expect(tables).toEqual(['users', 'orders', 'products', 'categories']);
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
      
      expect(tables).toContain('contact');
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
});
