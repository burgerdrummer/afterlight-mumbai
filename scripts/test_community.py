import unittest
from shapely.geometry import Polygon
from community_places import parse_community
class CommunityTest(unittest.TestCase):
    def test_provenance_bounds_and_verification(self):
        boundary=Polygon([(72.8,19),(72.9,19),(72.9,19.1),(72.8,19.1)])
        point={'type':'Feature','id':'synthetic-test-only','geometry':{'type':'Point','coordinates':[72.85,19.05]},'properties':{'name':'SYNTHETIC TEST FIXTURE','category':'pharmacy','source':'https://example.org/test-only','licence':'CC0-1.0','opening_hours':'24/7','checked':'2026-10-27','accessVerified':True}}
        parsed=parse_community({'type':'FeatureCollection','features':[point]},boundary)
        self.assertFalse(parsed[0]['accessVerified']);self.assertEqual(parsed[0]['hours'],'24/7')
        for property,value in [('source','javascript:alert(1)'),('licence',''),('checked','2099-01-01')]:
            copy={**point,'properties':{**point['properties'],property:value}}
            with self.assertRaises(ValueError):parse_community({'type':'FeatureCollection','features':[copy]},boundary)
        with self.assertRaises(ValueError):parse_community({'type':'FeatureCollection','features':[point,point]},boundary)
        with self.assertRaises(ValueError):parse_community({'type':'FeatureCollection','features':[{**point,'geometry':{'type':'Point','coordinates':[0,0]}}]},boundary)
if __name__=='__main__':unittest.main()
