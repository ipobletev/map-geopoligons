from turtle import shape
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import torch
import math
import random
from sklearn.decomposition import PCA
from IPython.display import display
import pandas as pd
import geopandas as gpd
import shapely


def translate(xarr, yarr, tx, ty):
    xret = []
    yret = []
    for i in range(len(xarr)):
        x = xarr[i] + tx
        y = yarr[i] + ty
        xret.append(x)
        yret.append(y)
    return xret, yret


def rotate(xarr, yarr, angle):
    xret = []
    yret = []
    for i in range(len(xarr)):
        x = math.cos(angle) * xarr[i] - math.sin(angle) * yarr[i]
        y = math.sin(angle) * xarr[i] + math.cos(angle) * yarr[i]
        xret.append(x)
        yret.append(y)
    return xret, yret


def get_pca_transform(xarr,yarr):
    n = len(xarr)
    X = []
    sx = 0
    sy = 0
    for i in range(n):
        X.append((xarr[i],yarr[i]))
        sx += xarr[i]
        sy += yarr[i]
    pca = PCA(n_components=2)
    X_fit = pca.fit(X)
    angle = math.atan2(pca.components_[0,1], pca.components_[0,0])
    return sx/n, sy/n, angle


def select_near_holes(xarr, yarr, holesx, holesy, d_thr):
    curve_xy = [(xarr[i],yarr[i]) for i in range(len(xarr))]
    holes_xy = [(holesx[i],holesy[i]) for i in range(len(holesx))]

    curve = shapely.LineString(curve_xy)
    holes = shapely.MultiPoint(holes_xy)

    street : shapely.Polygon = shapely.buffer(curve, d_thr)
    holes : shapely.MultiPoint = street.intersection(holes)

    xret = []
    yret = []
    xy : shapely.Point

    if not holes.is_empty:
        if type(holes) == shapely.MultiPoint:
            for xy in holes.geoms:
                xret.append(xy.x)
                yret.append(xy.y)
        else:
            xret.append(holes.x)
            yret.append(holes.y)

    return xret, yret


def select_near_geofence_points(xarr, yarr, geofx, geofy, d_thr):
    return select_near_holes(xarr, yarr, geofx, geofy, d_thr)


def sample_polygon(polygon : shapely.Polygon, dist = 1.0):
    boundary : shapely.LineString = polygon.boundary
    length = boundary.length
    points = shapely.line_interpolate_point(boundary, [x for x in np.arange(0, length, dist)])
    xret = []
    yret = []
    xy : shapely.Point
    for xy in points:
        xret.append(xy.x)
        yret.append(xy.y)
    return xret, yret

def my_loss(x, y, yo, xh, yh, xlow, ylow, xhigh, yhigh):
    loss = 0
    
    # New curve must be near old curve (small loss term)
    loss += 0.05 * torch.mean((y[1:-1]-yo[1:-1])**2)  # 0.4 # 1.0 
        
    # New curve must have small curvature
    curvature2 = (y[0:-2] + y[2:] - 2*y[1:-1] )**2 / (x[2:] - x[:-2])**2
    loss += 60*torch.mean(curvature2)

    # Penalize strong curvatures larger than that valid for Zeus
    loss += 200*torch.mean((curvature2-0.003)*torch.nn.ReLU()(curvature2-0.003))
    
    # New curve must keep the previous start/end
    loss += 10 * (y[0]-yo[0])**2
    loss += 10 * (y[1]-yo[1])**2
    loss += 10 * (y[-2]-yo[-2])**2
    loss += 10 * (y[-1]-yo[-1])**2
    
    # New curve must be far from cuttings
    '''
    for j in range(len(xh)):
        dx = x - xh[j]
        dy = y - yh[j]
        d2 = dx**2 + dy**2
        loss += (0.5 / d2 * torch.sigmoid(3*3 - d2)).sum()
    '''
    xh = torch.reshape(xh, (xh.shape[0], 1))
    yh = torch.reshape(yh, (yh.shape[0], 1))
    dx = x - xh
    dy = y - yh
    d2 = dx**2 + dy**2
    loss += (0.5 / d2 * torch.sigmoid(3*3 - d2)).sum()
    loss += (20.0 / (d2+0.5) * torch.sigmoid(5*(2.1*2.1 - d2)) ).sum()

    # Compute primer coordinates (xp,yp)
    L = torch.sqrt( (x[2:] - x[:-2])**2 + (y[2:] - y[:-2])**2)
    C = (x[2:] - x[:-2]) / L   # Cosine of angle
    S = (y[2:] - y[:-2]) / L   # Sine of angle

    xp = x[1:-1] + 3 * C
    yp = y[1:-1] + 3 * S

    # New curve must be far from low obstacles (eval at base_link)
    xlow = torch.reshape(xlow, (xlow.shape[0], 1))
    ylow = torch.reshape(ylow, (ylow.shape[0], 1))
    dx = x - xlow
    dy = y - ylow
    d2 = dx**2 + dy**2
    loss += (20.0 / (d2+0.5) * torch.sigmoid(5*(2.1*2.1 - d2)) ).sum()

    # New curve must be far from high obstacles (eval at base_link)
    xhigh = torch.reshape(xhigh, (xhigh.shape[0], 1))
    yhigh = torch.reshape(yhigh, (yhigh.shape[0], 1))
    dx = x - xhigh
    dy = y - yhigh
    d2 = dx**2 + dy**2
    loss += (20.0 / (d2+0.5) * torch.sigmoid(5*(2.1*2.1 - d2)) ).sum()

    # New curve must be far from high obstacles (eval at primer)
    dx = xp - xhigh[1:-1,:]
    dy = yp - yhigh[1:-1,:]
    d2 = dx**2 + dy**2
    loss += (2.0 / (d2+0.5) * torch.sigmoid(5*(2.1*2.1 - d2)) ).sum()

    return loss


class CurveModel(torch.nn.Module):
  def __init__(self, device, x, y0):
    super(CurveModel, self).__init__()
    self.yb = torch.clone(y0).to(device=device)
    self.y = torch.nn.Parameter(self.yb)
 
  def forward(self, x):
    return self.y


def fit_street(orig_x, orig_y, holes_x, holes_y, low_x, low_y, high_x, high_y):
    if len(orig_x) < 2:
        return orig_x, orig_y
    tx, ty, angle = get_pca_transform(orig_x,orig_y)

    orig_x, orig_y = translate(orig_x, orig_y, -tx, -ty)
    orig_x, orig_y = rotate(orig_x, orig_y, -angle)

    holes_x, holes_y = translate(holes_x, holes_y, -tx, -ty)
    holes_x, holes_y = rotate(holes_x, holes_y, -angle)    

    low_x, low_y = translate(low_x, low_y, -tx, -ty)
    low_x, low_y = rotate(low_x, low_y, -angle)    

    high_x, high_y = translate(high_x, high_y, -tx, -ty)
    high_x, high_y = rotate(high_x, high_y, -angle)    

    device = torch.device('cpu:0')

    xo = torch.Tensor(orig_x).to(device)
    yo = torch.Tensor(orig_y).to(device)

    xh = torch.Tensor(holes_x).to(device)
    yh = torch.Tensor(holes_y).to(device)

    xlow = torch.Tensor(low_x).to(device)
    ylow = torch.Tensor(low_y).to(device)

    xhigh = torch.Tensor(high_x).to(device)
    yhigh = torch.Tensor(high_y).to(device)

    model = CurveModel(device, xo, yo)

    #optim = torch.optim.SGD(model.parameters(), lr=0.001)
    optim = torch.optim.Adam(model.parameters(), lr=0.001)

    n_iters = 300 # 500
    for i in range(0, n_iters):
        if i == 100:
            for g in optim.param_groups:
                g['lr'] = 0.01

        if i == 200:
            for g in optim.param_groups:
                g['lr'] = 0.03

        predictions = model.forward(xo)
        loss = my_loss(xo, predictions, yo, xh, yh, xlow, ylow, xhigh, yhigh)
        loss.backward()
        optim.step()
        optim.zero_grad()

        if i % 50 == 0:
            print(f"epoch {i} / {n_iters}   loss {loss.item()}")
            if torch.isnan(predictions).any():
                print("NAN IN OPTIMIZATION")
    
    curve_x = orig_x
    curve_y = predictions.detach().cpu().numpy()

    if np.isnan(curve_y).any():
        print("NAN IN OPTIMIZATION - Reverting to original")
        curve_y = np.array(orig_y)

    curve_x, curve_y = rotate(curve_x, curve_y, angle)
    curve_x, curve_y = translate(curve_x, curve_y, tx, ty)

    return curve_x, curve_y


def gen_footprint_obstacle(x,y,angle):
    back = -3.5
    front = 3.5  #front = 6.5
    left = 1.8 
    right = -1.8
    c = math.cos(angle)
    s = math.sin(angle)

    footprint = shapely.Polygon([
        [x+c*back -s*left,  y+s*back +c*left],
        [x+c*front-s*left,  y+s*front+c*left],
        [x+c*front-s*right, y+s*front+c*right],
        [x+c*back -s*right, y+s*back +c*right],
        [x+c*back -s*left,  y+s*back +c*left]
    ])    
    return footprint

def gen_footprint_high_obstacle(x,y,angle):
    back = -3.5
    front = 6.5
    left = 1.8 
    right = -1.8
    c = math.cos(angle)
    s = math.sin(angle)

    footprint = shapely.Polygon([
        [x+c*back -s*left,  y+s*back +c*left],
        [x+c*front-s*left,  y+s*front+c*left],
        [x+c*front-s*right, y+s*front+c*right],
        [x+c*back -s*right, y+s*back +c*right],
        [x+c*back -s*left,  y+s*back +c*left]
    ])    
    return footprint



def del_colliding(orig_x, orig_y, holes_x, holes_y, low_x, low_y, high_x, high_y):
    if len(orig_x) < 2:
        return orig_x, orig_y
    tx, ty, angle = get_pca_transform(orig_x,orig_y)

    orig_x, orig_y = translate(orig_x, orig_y, -tx, -ty)
    orig_x, orig_y = rotate(orig_x, orig_y, -angle)

    holes_x, holes_y = translate(holes_x, holes_y, -tx, -ty)
    holes_x, holes_y = rotate(holes_x, holes_y, -angle)    

    low_x, low_y = translate(low_x, low_y, -tx, -ty)
    low_x, low_y = rotate(low_x, low_y, -angle)    

    high_x, high_y = translate(high_x, high_y, -tx, -ty)
    high_x, high_y = rotate(high_x, high_y, -angle)    

    holes = shapely.MultiPoint([[holes_x[i],holes_x[i]] for i in range(len(holes_x))])
    low = shapely.MultiPoint([[low_x[i],low_y[i]] for i in range(len(low_x))])
    high = shapely.MultiPoint([[high_x[i],high_y[i]] for i in range(len(high_x))])

    curve_x = []
    curve_y = []

    for i in range(len(orig_x)):
        if i > 0:
            ori = math.atan2(orig_y[i]-orig_y[i-1], orig_x[i]-orig_x[i-1])
        else:
            ori = math.atan2(orig_y[i+1]-orig_y[i], orig_x[i+1]-orig_x[i])
        footprint = gen_footprint_obstacle(orig_x[i], orig_y[i], ori)
        footprint_high = gen_footprint_high_obstacle(orig_x[i], orig_y[i], ori)
        if not holes.intersects(footprint) and not low.intersects(footprint) and not high.intersects(footprint_high):
            curve_x.append(orig_x[i])
            curve_y.append(orig_y[i])

    curve_x, curve_y = rotate(curve_x, curve_y, angle)
    curve_x, curve_y = translate(curve_x, curve_y, tx, ty)

    return curve_x, curve_y


def fit_all_streets(streets : gpd.GeoDataFrame, holes : gpd.GeoDataFrame, geofence : gpd.GeoDataFrame, obstacles : gpd.GeoDataFrame, high_obstacles : gpd.GeoDataFrame, fit_twice : bool, progress_callback=None):
    all_holes_x = holes['x'].to_list()
    all_holes_y = holes['y'].to_list()

    all_geof_x, all_geof_y = sample_polygon(geofence.geometry.iloc[0])
    low_x = []
    low_y = []

    if obstacles is not None:
        for row in obstacles.geometry:
            cx, cy = sample_polygon(row)
            low_x += cx
            low_y += cy

    if high_obstacles is not None:
        for row in high_obstacles.geometry:
            cx, cy = sample_polygon(row)
            all_geof_x += cx
            all_geof_y += cy

    total_streets = len(streets)
    for index, row in streets.iterrows():
        if progress_callback:
            # Progress from 1% to 10% during street fitting
            progress_callback(1 + 9 * (index / total_streets))

        street = shapely.segmentize(row['geometry'], max_segment_length=1.0)
        orig_x = []
        orig_y = []
        for xy in list(street.coords):
            orig_x.append(xy[0])
            orig_y.append(xy[1])
        holes_x, holes_y = select_near_holes(orig_x, orig_y, all_holes_x, all_holes_y, 7.0)
        geof_x, geof_y = select_near_geofence_points(orig_x, orig_y, all_geof_x, all_geof_y, 11.0)

        #display(holes.loc[holes_idx, 'drillhole_id'])

        #with open("streets.txt", "w") as f:
        #    f.write(str(holes_x) + "\n")
        #    f.write(str(holes_y) + "\n")
        #    f.write(str(orig_x) + "\n")
        #    f.write(str(orig_y) + "\n")

        curve_x, curve_y = fit_street(orig_x, orig_y, holes_x, holes_y, low_x, low_y, geof_x, geof_y)
        #curve_x, curve_y = orig_x, orig_y

        if fit_twice:
            curve_x, curve_y = del_colliding(curve_x, curve_y, holes_x, holes_y, low_x, low_y, geof_x, geof_y)
            curve_x, curve_y = fit_street(curve_x, curve_y, holes_x, holes_y, low_x, low_y, geof_x, geof_y)

        xy = []
        for i in range(len(curve_x)):
            xy.append( (curve_x[i], curve_y[i]) )
        
        streets.loc[index, 'geometry'] = shapely.LineString(xy)
        streets.loc[index, 'geometry'] = shapely.simplify(streets.loc[index, 'geometry'], 0.1)

    return streets

