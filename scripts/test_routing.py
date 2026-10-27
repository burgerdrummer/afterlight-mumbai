"""Actual local graph checks; no network requests and no fake city roads."""
import unittest
from valhalla import Actor
from routing_server import ROOT,calculate,metadata,validate

class CityRoutingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.actor=Actor(ROOT/'work/routing/valhalla.json');cls.attrs=metadata()
    def journey(self,mode,a,b,options=None):return calculate(self.actor,self.attrs,{'mode':mode,'origin':a,'destination':b,'departure':'2026-10-27T15:30:00Z','options':options or {}})['routes']
    def test_city_pairs_in_each_mode(self):
        for mode in ['walk','motorcycle','car']:
            for a,b in [([72.8347,18.922],[72.8261,18.9352]),([72.8465,19.1197],[72.8564,19.229]),([72.9080,19.0865],[72.957,19.1726])]:
                with self.subTest(mode=mode,pair=(a,b)):
                    routes=self.journey(mode,a,b);self.assertGreater(len(routes),0)
                    self.assertEqual([r['minutes'] for r in routes],sorted(r['minutes'] for r in routes))
                    for r in routes:
                        self.assertGreater(r['distance'],100);self.assertGreater(len(r['coords']),2);self.assertLess(max(r['snapDistances']),150)
                        self.assertAlmostEqual(sum(s['minutes'] for s in r['evidence']),r['minutes'],places=3)
                        self.assertTrue(all(s['kind'] not in {'footway','steps','pedestrian'} for s in r['evidence']) if mode!='walk' else True)
    def test_gateway_does_not_start_on_ferry(self):
        for mode in ['walk','motorcycle','car']:
            r=self.journey(mode,[72.8347,18.922],[72.8261,18.9352])[0]
            self.assertLess(r['distance'],6000);self.assertTrue(all(s['kind']!='unknown' for s in r['evidence']))
    def test_preferences_are_hard_checked(self):
        for mode in ['walk','motorcycle','car']:
            for r in self.journey(mode,[72.8465,19.1197],[72.8564,19.229],{'avoidStairs':True,'avoidTolls':True,'avoidUnpaved':True}):
                for s in r['evidence']:
                    self.assertNotEqual(s['kind'],'steps');self.assertNotIn(s['surface'],['unpaved','dirt','gravel','sand','mud','ground'])
                    self.assertNotEqual(self.attrs.get(s['way'],{}).get('toll'),'yes')
    def test_bad_requests(self):
        for origin in [[0,0],[float('nan'),19],[True,19]]:
            with self.assertRaises(ValueError):validate({'mode':'car','origin':origin,'destination':[72.83,19.05],'departure':'2026-10-27T15:30:00Z'})
    def test_india_defaults_and_timezone(self):
        r=self.actor.route({'locations':[{'lat':19.054377,'lon':72.837682},{'lat':19.049463,'lon':72.820916}],'costing':'auto','date_time':{'type':1,'value':'2026-10-27T21:00'}})
        t=self.actor.trace_attributes({'encoded_polyline':r['trip']['legs'][0]['shape'],'shape_match':'edge_walk','costing':'auto'})
        self.assertTrue(all(a.get('country_code')=='IN' for a in t['admins']))
        self.assertTrue(all(e['drive_on_right'] is False for e in t['edges']))
        self.assertTrue(all(p['time_zone_name']=='Asia/Kolkata' for p in r['trip']['locations']))

if __name__=='__main__':unittest.main()
