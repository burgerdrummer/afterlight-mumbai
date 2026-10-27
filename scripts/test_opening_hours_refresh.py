import copy,unittest
from refresh_opening_hours import in_boundary,normalized_records,merge_hours_records

BOUNDARY={'type':'Polygon','coordinates':[[[72.8,19],[72.9,19],[72.9,19.1],[72.8,19.1],[72.8,19]]]}
def element(ident=1,**tags):return {'type':'node','id':ident,'lon':72.85,'lat':19.05,'timestamp':'2026-10-27T00:00:00Z','tags':{'name':'Synthetic fixture only','shop':'convenience','opening_hours':'24/7',**tags}}
class OpeningHoursRefreshTest(unittest.TestCase):
    def test_filters_private_outside_and_missing_hours(self):
        outside={**element(2),'lon':73.5}
        records=normalized_records({'elements':[element(),element(3,access='private'),element(4,opening_hours=''),outside]},BOUNDARY)
        self.assertEqual(len(records),1);self.assertEqual(records[0]['licence'],'ODbL-1.0');self.assertFalse(records[0]['accessVerified']);self.assertIsNone(records[0]['checked'])
    def test_category_does_not_invent_schedule(self):
        self.assertEqual(normalized_records({'elements':[element(amenity='hospital',opening_hours='')]},BOUNDARY),[])
    def test_way_centres_and_holes(self):
        way={'type':'way','id':5,'center':{'lon':72.85,'lat':19.05},'tags':element()['tags']}
        self.assertEqual(normalized_records({'elements':[way]},BOUNDARY)[0]['id'],'way/5')
        with_hole=copy.deepcopy(BOUNDARY);with_hole['coordinates'].append([[72.84,19.04],[72.86,19.04],[72.86,19.06],[72.84,19.06],[72.84,19.04]])
        self.assertFalse(in_boundary([72.85,19.05],with_hole))
    def test_deduplicates_and_retains_hours_provenance(self):
        record=normalized_records({'elements':[element()]},BOUNDARY)[0]
        old={**record,'id':'overture/synthetic','hours':None,'hoursUpdated':None,'source':'https://example.org/synthetic','provider':'Overture Maps'}
        merged,counts=merge_hours_records([old],[record]);self.assertEqual(len(merged),1);self.assertEqual(counts['addedSchedules'],1);self.assertEqual(merged[0]['hoursSource'],record['source']);self.assertEqual(merged[0]['provider'],'Overture Maps');self.assertEqual(merged[0]['hoursLicence'],'ODbL-1.0')
        again,counts=merge_hours_records(merged,[record]);self.assertEqual(len(again),1);self.assertEqual(counts['addedSchedules'],0)
    def test_does_not_replace_newer_hours_with_older_source(self):
        record=normalized_records({'elements':[element()]},BOUNDARY)[0]
        old={**record,'hours':'Mo-Su 08:00-22:00','hoursUpdated':'2026-10-28T00:00:00Z'}
        merged,_=merge_hours_records([old],[record]);self.assertEqual(merged[0]['hours'],'Mo-Su 08:00-22:00')
    def test_rejects_incomplete_server_response(self):
        with self.assertRaises(ValueError):normalized_records({'elements':[],'remark':'timeout'},BOUNDARY)
if __name__=='__main__':unittest.main()
